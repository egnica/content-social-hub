import assert from "node:assert/strict";
import test from "node:test";
import { loadWithStubs } from "./helpers/load-with-stubs.js";

const id = "a".repeat(24), clientId = "b".repeat(24);
async function fixture(platform = "facebook", overrides = {}) {
  const connection = { _id: id, clientId, platform, providerAccountId: "account-1",
    tokenEncrypted: "encrypted", updatedAt: "2026-10-14", healthStatus: "healthy", ...overrides.connection };
  const calls = [];
  const profile = overrides.profile || { providerAccountId: "account-1", pictureUrl: "https://scontent.fbcdn.net/avatar.jpg?oe=1234" };
  const provider = async (...args) => { calls.push({ platform, args }); if (overrides.error) throw overrides.error; return profile; };
  const avatars = await loadWithStubs(new URL("../lib/social-account-avatar.js", import.meta.url), {
    getDb: async () => ({ collection: () => ({ findOne: async query => {
      assert.deepEqual(query.platform.$in, ["facebook", "instagram"]);
      return query._id === connection._id && query.clientId === connection.clientId && query.platform.$in.includes(connection.platform) ? connection : null;
    } }) }),
    toObjectId: value => /^[a-f0-9]{24}$/.test(value || "") ? value : null,
    decryptSecret: value => { assert.equal(value, "encrypted"); return "server-only-token"; },
    checkFacebookPage: provider, getInstagramProfile: provider,
  });
  return { avatars, connection, calls };
}

test("Meta avatar lookup refreshes the exact account and coalesces chip/detail requests", async () => {
  for (const platform of ["facebook", "instagram"]) {
    const f = await fixture(platform);
    const urls = await Promise.all([f.avatars.getSocialAccountAvatarUrl(id, clientId), f.avatars.getSocialAccountAvatarUrl(id, clientId)]);
    assert.deepEqual(urls, ["https://scontent.fbcdn.net/avatar.jpg?oe=1234", "https://scontent.fbcdn.net/avatar.jpg?oe=1234"]);
    assert.equal(f.calls.length, 1);
    if (platform === "facebook") {
      assert.equal(f.calls[0].args[0], "account-1");
      assert.equal(f.calls[0].args[1], "server-only-token");
      assert.ok(f.calls[0].args[2].signal instanceof AbortSignal);
    } else assert.equal(f.calls[0].args[0], "server-only-token");
  }
});

test("cache still verifies the current client and invalidates after account updates", async () => {
  const f = await fixture();
  await f.avatars.getSocialAccountAvatarUrl(id, clientId);
  assert.equal(await f.avatars.getSocialAccountAvatarUrl(id, "c".repeat(24)), null);
  f.connection.updatedAt = "2026-10-15";
  await f.avatars.getSocialAccountAvatarUrl(id, clientId);
  assert.equal(f.calls.length, 2);
});

test("invalid, missing, disconnected and non-Meta connections never use credentials", async () => {
  for (const connection of [{}, { healthStatus: "disconnected" }, { platform: "youtube" }, { tokenEncrypted: "" }]) {
    const f = await fixture("facebook", { connection });
    assert.equal(await f.avatars.getSocialAccountAvatarUrl("bad-id", clientId), null);
    assert.equal(await f.avatars.getSocialAccountAvatarUrl(id, "bad-client"), null);
    assert.equal(await f.avatars.getSocialAccountAvatarUrl(id, "c".repeat(24)), null);
    if (Object.keys(connection).length) assert.equal(await f.avatars.getSocialAccountAvatarUrl(id, clientId), null);
    assert.equal(f.calls.length, 0);
  }
});

test("photo identity mismatch fails without returning another account's photo", async () => {
  const f = await fixture("instagram", { profile: { providerAccountId: "another-account", pictureUrl: "https://scontent.cdninstagram.com/avatar.jpg" } });
  await assert.rejects(f.avatars.getSocialAccountAvatarUrl(id, clientId), /identity/);
});

test("photo targets must be HTTPS Meta CDN URLs without credentials or token parameters", async () => {
  for (const pictureUrl of ["", "http://scontent.fbcdn.net/avatar.jpg", "https://fbcdn.net.evil.example/a",
    "https://127.0.0.1/a", "https://scontent.fbcdn.net:444/a", "https://user:password@scontent.fbcdn.net/a",
    "https://scontent.fbcdn.net/a?access_token=secret", "data:image/png;base64,abc"]) {
    const f = await fixture("facebook", { profile: { providerAccountId: "account-1", pictureUrl } });
    assert.equal(await f.avatars.getSocialAccountAvatarUrl(id, clientId), null);
  }
});

test("failed optional photo lookup suppresses repeat calls without changing connection health", async () => {
  const f = await fixture("instagram", { error: new Error("provider failed") });
  await assert.rejects(f.avatars.getSocialAccountAvatarUrl(id, clientId), /provider failed/);
  assert.equal(await f.avatars.getSocialAccountAvatarUrl(id, clientId), null);
  assert.equal(f.calls.length, 1);
  assert.equal(f.connection.healthStatus, "healthy");
});

test("avatar endpoint requires an owner session and keeps failures private", async () => {
  const endpoint = new URL("../app/api/connections/[id]/avatar/route.js", import.meta.url);
  const blocked = await loadWithStubs(endpoint, {
    requireApiSession: async () => new Response(null, { status: 401 }),
    getSocialAccountAvatarUrl: async () => { throw new Error("must not run"); },
  });
  assert.equal((await blocked.GET(new Request("https://example.test/api/connections/id/avatar"), { params: Promise.resolve({ id }) })).status, 401);
  for (const throws of [false, true]) {
    const route = await loadWithStubs(endpoint, {
      requireApiSession: async () => null,
      getSocialAccountAvatarUrl: async (requestedId, requestedClient) => {
        assert.equal(requestedId, id); assert.equal(requestedClient, clientId);
        if (throws) throw new Error("access_token=private");
        return "https://scontent.fbcdn.net/avatar.jpg";
      },
    });
    const response = await route.GET(new Request(`https://example.test/api/connections/${id}/avatar?clientId=${clientId}`), { params: Promise.resolve({ id }) });
    assert.equal(response.status, throws ? 404 : 307);
    assert.match(response.headers.get("Cache-Control"), /private/);
    assert.equal(await response.text(), "");
    if (!throws) {
      assert.equal(response.headers.get("Location"), "https://scontent.fbcdn.net/avatar.jpg");
      assert.equal(response.headers.get("Vary"), "Cookie");
    }
  }
});
