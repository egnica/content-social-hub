import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import * as logic from "../lib/google-business-connection-logic.js";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import { fakeCollection, matches } from "./helpers/fake-mongo.js";

const scope = logic.GOOGLE_BUSINESS_SCOPE;
const location = logic.normalizeGoogleBusinessLocation({ name: "accounts/123", accountName: "Business group" }, {
  name: "locations/456", title: "Business One", storefrontAddress: { addressLines: ["123 Main St"], locality: "Minneapolis" },
});
const hash = value => createHash("sha256").update(value).digest("hex");
const tokens = () => ({ accessToken: "access-secret", refreshToken: "refresh-secret", grantedScopes: [scope], expiresAt: new Date(Date.now() + 3600000) });

async function provider(fetcher) {
  return loadWithStubs(new URL("../lib/google-business.js", import.meta.url), {
    ...logic, fetch: fetcher, getAppBaseUrl: () => "https://hub.example", requireEnv: name => name,
  });
}

test("Business consent requests its own scope, offline access and the real application callback", async () => {
  const api = await provider(() => { throw new Error("Unexpected network"); });
  const url = new URL(api.createGoogleBusinessAuthorizationUrl("state"));
  assert.equal(url.searchParams.get("scope"), scope);
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("redirect_uri"), "https://hub.example/api/connections/google-business/callback");
  assert.equal(url.searchParams.get("client_id"), "GOOGLE_BUSINESS_CLIENT_ID");
  assert.equal(url.searchParams.get("state"), "state");
});

test("Business lookup traverses paginated accounts and locations without posting", async () => {
  const calls = [];
  const api = await provider(async (url, options) => {
    const u = new URL(url); calls.push(u);
    assert.equal(options.method, undefined);
    assert.equal(options.headers.Authorization, "Bearer access-secret");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal);
    if (u.hostname === "mybusinessaccountmanagement.googleapis.com") return Response.json(
      u.searchParams.has("pageToken") ? { accounts: [{ name: "accounts/999", accountName: "Second" }] }
        : { accounts: [{ name: "accounts/123", accountName: "First" }], nextPageToken: "accounts-next" });
    assert.equal(u.searchParams.get("readMask"), "name,title,storefrontAddress");
    if (u.pathname.includes("999")) return Response.json({ locations: [{ name: "locations/888", title: "Second" }] });
    return Response.json(u.searchParams.has("pageToken")
      ? { locations: [{ name: "locations/777", title: "Another" }] }
      : { locations: [{ name: "locations/456", title: "First" }], nextPageToken: "locations-next" });
  });
  const result = await api.listGoogleBusinessLocations("access-secret");
  assert.equal(result.length, 3);
  assert.equal(calls.length, 5);
  assert.equal(result[0].providerParent, "accounts/123/locations/456");
});

test("lookup refuses malformed resource paths, repeated pagination and oversized scans", async () => {
  assert.throws(() => logic.assertGoogleBusinessResource("accounts/123/../../evil", "accounts"));
  const cyclic = await provider(async () => Response.json({ accounts: [], nextPageToken: "repeat" }));
  await assert.rejects(cyclic.listGoogleBusinessLocations("token"), e => e.reason === "incomplete");
  let calls = 0;
  const tooMany = await provider(async () => Response.json({ accounts: [], nextPageToken: String(++calls) }));
  await assert.rejects(tooMany.listGoogleBusinessLocations("token"), e => e.reason === "incomplete");
  assert.equal(calls, 30);
});

test("quota, disabled service, authorization and permissions errors are distinct and redact provider payloads", async () => {
  for (const [status, reason, details] of [[429, "quota", []], [403, "disabled", [{ reason: "SERVICE_DISABLED" }]],
    [403, "permissions", []], [401, "authorization", []]]) {
    const api = await provider(async () => Response.json({ error: { message: "access-secret", details } }, { status }));
    await assert.rejects(api.listGoogleBusinessLocations("access-secret"), error => {
      assert.equal(error.reason, reason);
      assert.equal(error.message.includes("access-secret"), false);
      assert.equal(JSON.stringify(error).includes("access-secret"), false);
      return true;
    });
  }
});

test("renewal uses dedicated client credentials and rejects malformed or revoked tokens", async () => {
  const api = await provider(async (url, options) => {
    assert.equal(url, "https://oauth2.googleapis.com/token");
    assert.equal(options.body.get("client_id"), "GOOGLE_BUSINESS_CLIENT_ID");
    assert.equal(options.body.get("client_secret"), "GOOGLE_BUSINESS_CLIENT_SECRET");
    assert.equal(options.body.get("refresh_token"), "refresh-secret");
    return Response.json({ access_token: "new-access", expires_in: 3600 });
  });
  const result = await api.refreshGoogleBusinessToken("refresh-secret");
  assert.equal(result.accessToken, "new-access");
  assert.deepEqual(result.grantedScopes, []);
  assert.equal(result.refreshToken, "");
  const invalid = await provider(async () => Response.json({ error: "invalid_grant", error_description: "refresh-secret" }, { status: 400 }));
  await assert.rejects(invalid.refreshGoogleBusinessToken("refresh-secret"), e => e.reason === "authorization" && !e.message.includes("refresh-secret"));
  const malformed = await provider(async () => Response.json({ access_token: "new", expires_in: "invalid" }));
  await assert.rejects(malformed.refreshGoogleBusinessToken("refresh-secret"));
});

test("location verification proves access through the exact saved account and refuses another location", async () => {
  const api = await provider(async url => {
    assert.equal(new URL(url).pathname, "/v1/accounts/123/locations");
    return Response.json({ locations: [{ name: "locations/456", title: "Business" }] });
  });
  assert.equal((await api.verifyGoogleBusinessLocation("token", "accounts/123", "locations/456")).providerAccountId, "locations/456");
  await assert.rejects(api.verifyGoogleBusinessLocation("token", "accounts/123", "locations/999"), e => e.reason === "permissions");
});

test("location access health never claims a publishing capability", () => {
  const input = { grantedScopes: [scope], tokenExpiresAt: tokens().expiresAt, hasRefreshToken: true, locationId: "locations/456" };
  assert.equal(logic.getGoogleBusinessHealth(input).healthStatus, "healthy");
  assert.equal(logic.getGoogleBusinessHealth(input).canPublish, false);
  assert.equal(logic.getGoogleBusinessHealth({ ...input, grantedScopes: [] }).canManageLocation, false);
  assert.equal(logic.getGoogleBusinessHealth({ ...input, hasRefreshToken: false }).healthStatus, "permission_problem");
  assert.equal(logic.getGoogleBusinessHealth({ ...input, tokenExpiresAt: "bad" }).healthStatus, "expired");
});

function collection(documents = []) {
  const c = fakeCollection(documents);
  c.insertOne = async doc => { documents.push({ ...structuredClone(doc), _id: randomUUID() }); };
  c.findOneAndUpdate = async (filter, update, options = {}) => {
    let doc = documents.find(d => matches(d, filter));
    if (!doc && options.upsert) { doc = { ...filter, _id: randomUUID(), ...update.$setOnInsert }; documents.push(doc); }
    if (!doc) return null;
    const before = structuredClone(doc);
    Object.assign(doc, structuredClone(update.$set));
    c.writes.push({ filter, update });
    return options.returnDocument === "before" ? before : structuredClone(doc);
  };
  return c;
}

async function setup(overrides = {}) {
  const collections = Object.fromEntries(["clients", "social_connections", "oauth_states", "account_selection_flows", "connection_requests", "email_log"]
    .map(name => [name, collection(name === "clients" ? [{ _id: "clientA", name: "Client A" }, { _id: "clientB", name: "Client B" }] : [])]));
  const api = await provider(async () => { throw new Error("Unexpected live fetch"); });
  const stubs = {
    ...logic, GoogleBusinessApiError: api.GoogleBusinessApiError,
    getDb: async () => ({ collection: name => collections[name] }),
    toObjectId: value => typeof value === "string" && value ? value : null,
    serializeDocument: doc => doc ? structuredClone(doc) : null,
    createSecureToken: () => randomUUID(), hashSecureToken: hash,
    encryptSecret: value => `encrypted:${value}`, decryptSecret: value => value.slice(10),
    requireEnv: () => "oauth-client", verifyGoogleBusinessLocation: async () => location,
    refreshGoogleBusinessToken: async () => ({ ...tokens(), accessToken: "renewed-secret", refreshToken: "", grantedScopes: [] }),
    ...overrides,
  };
  const server = await loadWithStubs(new URL("../lib/connections.js", import.meta.url), stubs);
  return { server, collections, stubs };
}

async function pending(s, { clientId = "clientA", connectionId = "", tokenOverrides = {} } = {}) {
  const stateValue = await s.server.createGoogleBusinessOauthState({ clientId, connectionId });
  const state = await s.server.consumeGoogleBusinessOauthState(stateValue);
  const token = await s.server.createGoogleBusinessSelectionFlow({ state, locations: [location], tokens: { ...tokens(), ...tokenOverrides } });
  return { stateValue, state, token };
}

test("one-time state and encrypted selection are scoped to an existing client and redact secrets", async () => {
  const s = await setup(), p = await pending(s);
  assert.equal(await s.server.consumeGoogleBusinessOauthState(p.stateValue), null);
  assert.equal(s.collections.oauth_states.documents[0].stateHash, hash(p.stateValue));
  const publicFlow = await s.server.getGoogleBusinessSelectionFlow(p.token);
  assert.equal(publicFlow.clientName, "Client A");
  assert.equal(JSON.stringify(publicFlow).includes("secret"), false);
  assert.equal(s.collections.account_selection_flows.documents[0].tokenEncrypted, "encrypted:access-secret");
  await assert.rejects(s.server.createGoogleBusinessOauthState({ clientId: "unknown" }), /Client/);
});

test("confirmation rechecks provider identity, saves one client-owned location and cannot be replayed", async () => {
  const s = await setup(), p = await pending(s);
  const result = await s.server.completeGoogleBusinessSelection(p.token, location.providerParent);
  assert.equal(result.clientId, "clientA"); assert.equal(result.providerAccountId, "locations/456");
  assert.equal(result.capabilities.canPublish, false); assert.equal(result.capabilities.canManageLocation, true);
  assert.equal(result.tokenEncrypted, undefined); assert.equal(result.refreshTokenEncrypted, undefined);
  assert.equal(s.collections.social_connections.documents[0].refreshTokenEncrypted, "encrypted:refresh-secret");
  await assert.rejects(s.server.completeGoogleBusinessSelection(p.token, location.providerParent));
  assert.equal(s.collections.social_connections.documents.length, 1);
});

test("unoffered selection, expired flow, deleted client and wrong provider identity cannot save a connection", async () => {
  for (const failure of ["unoffered", "expired", "client-deleted", "identity"]) {
    const s = await setup(failure === "identity" ? { verifyGoogleBusinessLocation: async () => ({ ...location, providerAccountId: "locations/999" }) } : {});
    const p = await pending(s);
    if (failure === "expired") s.collections.account_selection_flows.documents[0].expiresAt = new Date(0);
    if (failure === "client-deleted") s.collections.clients.documents.splice(0, 1);
    await assert.rejects(s.server.completeGoogleBusinessSelection(p.token, failure === "unoffered" ? "accounts/123/locations/999" : location.providerParent));
    assert.equal(s.collections.social_connections.documents.length, 0);
  }
});

test("cross-client reconnect is rejected and a same-location reconnect preserves missing refresh tokens", async () => {
  const s = await setup(), first = await pending(s);
  const saved = await s.server.completeGoogleBusinessSelection(first.token, location.providerParent);
  await assert.rejects(s.server.createGoogleBusinessOauthState({ clientId: "clientB", connectionId: saved._id }));
  const reconnect = await pending(s, { connectionId: saved._id, tokenOverrides: { refreshToken: "" } });
  const result = await s.server.completeGoogleBusinessSelection(reconnect.token, location.providerParent);
  assert.equal(result._id, saved._id); assert.equal(s.collections.social_connections.documents.length, 1);
  assert.equal(s.collections.social_connections.documents[0].refreshTokenEncrypted, "encrypted:refresh-secret");
});

test("wrong-location reconnect and concurrent credential changes cannot overwrite saved authorization", async () => {
  const s = await setup(), first = await pending(s);
  const saved = await s.server.completeGoogleBusinessSelection(first.token, location.providerParent);
  const stateValue = await s.server.createGoogleBusinessOauthState({ clientId: "clientA", connectionId: saved._id });
  const state = await s.server.consumeGoogleBusinessOauthState(stateValue);
  await assert.rejects(s.server.createGoogleBusinessSelectionFlow({ state, locations: [{ ...location, providerAccountId: "locations/999" }], tokens: tokens() }));
  const token = await s.server.createGoogleBusinessSelectionFlow({ state, locations: [location], tokens: tokens() });
  s.collections.social_connections.documents[0].tokenEncrypted = "encrypted:newer-connect";
  await assert.rejects(s.server.completeGoogleBusinessSelection(token, location.providerParent), /changed/);
  assert.equal(s.collections.social_connections.documents[0].tokenEncrypted, "encrypted:newer-connect");
});

test("missing offline access and scope prevent new connections", async () => {
  const s = await setup(), p = await pending(s, { tokenOverrides: { refreshToken: "" } });
  await assert.rejects(s.server.completeGoogleBusinessSelection(p.token, location.providerParent), /offline/);
  assert.equal(s.collections.social_connections.documents.length, 0);
  const state = await s.server.consumeGoogleBusinessOauthState(await s.server.createGoogleBusinessOauthState({ clientId: "clientA" }));
  await assert.rejects(s.server.createGoogleBusinessSelectionFlow({ state, locations: [location], tokens: { ...tokens(), grantedScopes: [] } }), /permission/);
});

test("health renews near expiry, retains omitted scope and refresh token, and returns no credential", async () => {
  const s = await setup(), p = await pending(s);
  const saved = await s.server.completeGoogleBusinessSelection(p.token, location.providerParent);
  s.collections.social_connections.documents[0].tokenExpiresAt = new Date(0);
  const result = await s.server.refreshSocialConnectionHealth(saved._id);
  assert.equal(result.healthStatus, "healthy"); assert.deepEqual(result.grantedScopes, [scope]);
  assert.equal(result.tokenEncrypted, undefined); assert.equal(result.refreshTokenEncrypted, undefined);
  assert.equal(s.collections.social_connections.documents[0].tokenEncrypted, "encrypted:renewed-secret");
  assert.equal(s.collections.social_connections.documents[0].refreshTokenEncrypted, "encrypted:refresh-secret");
});

test("revoked credentials report Expired and quota failures do not misrepresent usable access", async () => {
  for (const reason of ["authorization", "quota"]) {
    const api = await provider(async () => {});
    const s = await setup();
    const p = await pending(s), saved = await s.server.completeGoogleBusinessSelection(p.token, location.providerParent);
    const error = new api.GoogleBusinessApiError(reason);
    const server = await loadWithStubs(new URL("../lib/connections.js", import.meta.url), { ...s.stubs,
      GoogleBusinessApiError: api.GoogleBusinessApiError, verifyGoogleBusinessLocation: async () => { throw error; } });
    const result = await server.refreshSocialConnectionHealth(saved._id);
    assert.equal(result.healthStatus, reason === "authorization" ? "expired" : "api_error");
    assert.equal(result.capabilities.canPublish, false); assert.equal(result.tokenEncrypted, undefined);
    assert.equal(s.collections.social_connections.documents[0].tokenEncrypted, "encrypted:access-secret");
  }
});

const nextResponse = {
  redirect(url, status) {
    const response = new Response(null, { status, headers: { Location: String(url) } });
    response.cookies = { set() {} };
    return response;
  },
};

test("direct start requires owner authentication before creating any OAuth state", async () => {
  let stateCalls = 0;
  const route = await loadWithStubs(new URL("../app/api/connections/google-business/start/route.js", import.meta.url), {
    NextResponse: nextResponse, getSession: async () => null, getAppBaseUrl: () => "https://hub.example",
    createGoogleBusinessOauthState: async () => { stateCalls++; },
  });
  const response = await route.GET(new Request("https://hub.example/api/connections/google-business/start?clientId=clientA"));
  assert.equal(response.status, 303); assert.equal(response.headers.get("Location"), "https://hub.example/login");
  assert.equal(stateCalls, 0);
});

test("callback rejects a different browser before exchanging a code or consuming state", async () => {
  let consumed = 0;
  const route = await loadWithStubs(new URL("../app/api/connections/google-business/callback/route.js", import.meta.url), {
    NextResponse: nextResponse, getAppBaseUrl: () => "https://hub.example", getSession: async () => ({ role: "owner" }),
    matchesGoogleBusinessBrowser: async () => false, GOOGLE_BUSINESS_STATE_COOKIE: "state-cookie",
    googleBusinessCookieOptions: () => ({}), consumeGoogleBusinessOauthState: async () => { consumed++; },
  });
  const response = await route.GET(new Request("https://hub.example/api/connections/google-business/callback?state=attacker&code=private-code"));
  assert.equal(new URL(response.headers.get("Location")).searchParams.get("reason"), "invalid");
  assert.equal(consumed, 0); assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
});

test("confirmation requires an owner and browser-bound flow before touching credentials or storage", async () => {
  let saved = 0;
  const stubs = { readJson: async () => ({ token: "flow", providerParent: location.providerParent }),
    matchesGoogleBusinessBrowser: async () => false, GOOGLE_BUSINESS_SELECTION_COOKIE: "selection-cookie",
    completeGoogleBusinessSelection: async () => { saved++; },
  };
  const unauthorized = await loadWithStubs(new URL("../app/api/connections/google-business/confirm/route.js", import.meta.url), {
    ...stubs, requireApiSession: async () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  });
  assert.equal((await unauthorized.POST(new Request("https://hub.example"))).status, 401);
  const wrongBrowser = await loadWithStubs(new URL("../app/api/connections/google-business/confirm/route.js", import.meta.url), {
    ...stubs, requireApiSession: async () => null,
  });
  assert.equal((await wrongBrowser.POST(new Request("https://hub.example"))).status, 403);
  assert.equal(saved, 0);
});

test("OAuth browser proof checks a hashed HttpOnly cookie and refuses missing or mismatched state", async () => {
  const browser = await loadWithStubs(new URL("../lib/google-business-oauth-browser.js", import.meta.url), {
    cookies: async () => ({ get: () => ({ value: hash("state") }) }), hashSecureToken: hash,
  });
  assert.equal(await browser.matchesGoogleBusinessBrowser("cookie", "state"), true);
  assert.equal(await browser.matchesGoogleBusinessBrowser("cookie", "other"), false);
  assert.equal(await browser.matchesGoogleBusinessBrowser("cookie", null), false);
  assert.equal(browser.googleBusinessCookieOptions(600).httpOnly, true);
  assert.equal(browser.googleBusinessCookieOptions(600).sameSite, "lax");
});

test("concurrent reconnect during a health lookup preserves the newer credential", async () => {
  const s = await setup(), p = await pending(s);
  const saved = await s.server.completeGoogleBusinessSelection(p.token, location.providerParent);
  const current = s.collections.social_connections.documents[0];
  current.tokenExpiresAt = new Date(0);
  const server = await loadWithStubs(new URL("../lib/connections.js", import.meta.url), {
    ...s.stubs, verifyGoogleBusinessLocation: async () => { current.tokenEncrypted = "encrypted:newer-reconnect"; return location; },
  });
  const result = await server.refreshSocialConnectionHealth(saved._id);
  assert.equal(current.tokenEncrypted, "encrypted:newer-reconnect");
  assert.equal(result.tokenEncrypted, undefined);
});
