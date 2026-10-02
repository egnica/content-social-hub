import assert from "node:assert/strict";
import test from "node:test";
import {
  shouldRenewInstagramToken,
  renewInstagramConnection,
} from "../lib/instagram-token-maintenance.js";
import { fakeCollection } from "./helpers/fake-mongo.js";
import { loadWithStubs } from "./helpers/load-with-stubs.js";

const day = 86_400_000;
const now = new Date("2026-10-02T12:00:00Z");
const connection = () => ({
  _id: "connection",
  clientId: "client",
  providerAccountId: "ig-account",
  platform: "instagram",
  tokenEncrypted: "encrypted-old",
  tokenExpiresAt: new Date(+now + 6 * day),
  createdAt: new Date(+now - 54 * day),
});

test("renewal requires a known unexpired long-lived token, 24-hour age and cooldown", () => {
  const base = connection();
  assert.equal(shouldRenewInstagramToken(base, now), true);
  for (const change of [
    { platform: "facebook" },
    { tokenExpiresAt: null },
    { tokenExpiresAt: "bad" },
    { tokenExpiresAt: now },
    { tokenExpiresAt: new Date(+now + 8 * day) },
    { tokenIssuedAt: new Date(+now - day + 1) },
    { tokenRenewedAt: now },
    { createdAt: null },
    { tokenRefreshAttemptAt: new Date(+now - 3_600_000 + 1) },
  ])
    assert.equal(
      shouldRenewInstagramToken({ ...base, ...change }, now),
      false,
      JSON.stringify(change),
    );
  assert.equal(
    shouldRenewInstagramToken(
      { ...base, tokenIssuedAt: new Date(+now - day) },
      now,
    ),
    true,
  );
});

function setup(overrides = {}) {
  const original = connection();
  const connections = fakeCollection([structuredClone(original)]);
  const calls = [];
  const args = {
    connections,
    connection: original,
    now,
    decrypt: (value) => {
      assert.equal(value, "encrypted-old");
      return "old-secret";
    },
    refreshToken: async (token) => {
      calls.push(token);
      return {
        accessToken: "new-secret",
        expiresAt: new Date(+now + 60 * day),
      };
    },
    getProfile: async (token) => {
      assert.equal(token, "new-secret");
      return { providerAccountId: "ig-account" };
    },
    encrypt: (token) => `encrypted-${token}`,
    ...overrides,
  };
  return { args, connections, calls };
}

test("renewal verifies the refreshed identity then atomically saves encrypted credentials and expiry", async () => {
  const { args, connections, calls } = setup();
  const result = await renewInstagramConnection(args);
  assert.deepEqual(calls, ["old-secret"]);
  assert.equal(result.connection.tokenEncrypted, "encrypted-new-secret");
  assert.equal(+result.connection.tokenExpiresAt, +now + 60 * day);
  assert.equal(+result.connection.tokenRenewedAt, +now);
  assert.equal(connections.documents[0].clientId, "client");
  assert.equal(connections.documents[0].accessToken, undefined);
});

test("identity mismatch and provider rejection preserve the old credential and record a cooldown", async () => {
  for (const overrides of [
    { getProfile: async () => ({ providerAccountId: "wrong-account" }) },
    {
      refreshToken: async () => {
        throw new Error("Provider unavailable");
      },
    },
    {
      refreshToken: async () => ({
        accessToken: "new-secret",
        expiresAt: "invalid",
      }),
    },
  ]) {
    const { args, connections } = setup(overrides);
    await assert.rejects(renewInstagramConnection(args));
    assert.equal(connections.documents[0].tokenEncrypted, "encrypted-old");
    assert.equal(+connections.documents[0].tokenRefreshErrorAt, +now);
    assert.equal(
      shouldRenewInstagramToken(connections.documents[0], now),
      false,
    );
  }
});

test("concurrent renewal performs one provider refresh", async () => {
  const { args, calls } = setup();
  await Promise.all([
    renewInstagramConnection(args),
    renewInstagramConnection(args),
  ]);
  assert.equal(calls.length, 1);
});

test("a concurrent reconnect wins over the older renewal result", async () => {
  const { args, connections } = setup();
  args.getProfile = async () => {
    connections.documents[0].tokenEncrypted = "encrypted-reconnected";
    connections.documents[0].tokenExpiresAt = new Date(+now + 55 * day);
    return { providerAccountId: "ig-account" };
  };
  const result = await renewInstagramConnection(args);
  assert.equal(result.connection.tokenEncrypted, "encrypted-reconnected");
  assert.equal(+result.connection.tokenExpiresAt, +now + 55 * day);
});

test("an expired token never reaches the refresh endpoint", async () => {
  const { args, calls } = setup();
  args.connection.tokenExpiresAt = now;
  await renewInstagramConnection(args);
  assert.equal(calls.length, 0);
});

test("provider renewal uses the Instagram endpoint and rejects malformed results without exposing secrets", async () => {
  let requestUrl;
  const originalFetch = globalThis.fetch;
  const serverModule = await loadWithStubs(
    new URL("../lib/instagram.js", import.meta.url),
    { getAppBaseUrl: () => "", requireEnv: () => "" },
  );
  try {
    globalThis.fetch = async (url) => {
      requestUrl = url;
      return Response.json({ access_token: "rotated", expires_in: 5_184_000 });
    };
    const refreshed =
      await serverModule.refreshInstagramAccessToken("private-secret");
    assert.equal(
      requestUrl.origin + requestUrl.pathname,
      "https://graph.instagram.com/refresh_access_token",
    );
    assert.equal(requestUrl.searchParams.get("grant_type"), "ig_refresh_token");
    assert.equal(requestUrl.searchParams.get("access_token"), "private-secret");
    assert.equal(refreshed.accessToken, "rotated");
    globalThis.fetch = async () =>
      Response.json(
        { error: { code: 190, message: "private-secret" } },
        { status: 400 },
      );
    await assert.rejects(
      serverModule.refreshInstagramAccessToken("private-secret"),
      (error) => {
        assert.equal(error.details.code, 190);
        assert.equal(JSON.stringify(error).includes("private-secret"), false);
        assert.equal(error.message.includes("private-secret"), false);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
