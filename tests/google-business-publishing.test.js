import assert from "node:assert/strict";
import test from "node:test";
import { fakeCollection } from "./helpers/fake-mongo.js";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import * as logic from "../lib/google-business-publish-logic.js";
import { googleBusinessParent } from "../lib/google-business-post-logic.js";

const parent = "accounts/123/locations/456";
const result = (state = "LIVE") => ({ name: `${parent}/localPosts/post-1`, state, searchUrl: "https://local.google.com/place?id=456&use=posts&lpsid=123" });
async function fixture(options = {}) {
  const version = { _id: "version", platform: "google_business_profile", active: true,
    clientId: "client", masterContentId: "master", socialConnectionId: "connection", providerAccountId: "locations/456",
    googleBusinessParent: parent, revision: 1, masterRevisionSynced: 1,
    summary: "A real future update", ctaType: "LEARN_MORE", ctaUrl: "https://example.org", mediaIds: [] };
  const tables = {
    platform_versions: fakeCollection([version]), publish_attempts: fakeCollection([]),
    master_content: fakeCollection([{ _id: "master", clientId: "client", revision: 1 }]),
    social_connections: fakeCollection([{ _id: "connection", clientId: "client", platform: "google_business_profile",
      providerAccountId: "locations/456", accountResourceName: "accounts/123", locationResourceName: "locations/456",
      providerParent: parent, tokenEncrypted: "old", healthStatus: "healthy", capabilities: { canManageLocation: true, canPublish: false } }]),
  };
  const attempts = tables.publish_attempts;
  attempts.insertOne = async document => {
    if (attempts.documents.some(a => a.submissionKey && a.submissionKey === document.submissionKey)) throw Object.assign(new Error("duplicate"), { code: 11000 });
    const _id = `attempt-${attempts.documents.length}`;
    attempts.documents.push({ ...document, _id }); return { insertedId: _id };
  };
  const events = [];
  const server = await loadWithStubs(new URL("../lib/google-business-publishing.js", import.meta.url), {
    ...logic, googleBusinessParent, getDb: async () => ({ collection: name => tables[name] }),
    toObjectId: id => id, serializeDocument: value => structuredClone(value), decryptSecret: value => `decrypted-${value}`,
    refreshSocialConnectionHealth: async () => { events.push("health"); tables.social_connections.documents[0].tokenEncrypted = "renewed"; await options.onHealth?.(tables); },
    checkGoogleBusinessPostsAccess: async ({ accessToken, parent: actualParent }) => {
      events.push("access"); assert.equal(accessToken, "decrypted-renewed"); assert.equal(actualParent, parent);
      if (options.accessError) throw options.accessError;
      await options.onAccess?.(tables);
    },
    createGoogleBusinessPost: async args => {
      events.push("create"); assert.equal(args.accessToken, "decrypted-renewed");
      assert.equal(args.parent, parent); if (options.createError) throw options.createError;
      await options.onCreate?.(tables);
      return logic.googleBusinessPostResult(result(options.state || "LIVE"), parent);
    },
    getGoogleBusinessPost: async ({ name }) => {
      events.push("get"); assert.equal(name, result().name);
      if (options.getError) throw options.getError;
      return logic.googleBusinessPostResult(result(options.refreshedState || "LIVE"), parent, name);
    },
  });
  return { server, tables, events, version };
}

test("publishes one exact revision using renewed credentials, durable result and duplicate lock", async () => {
  const f = await fixture();
  const published = await f.server.publishGoogleBusinessVersion("version", 1);
  assert.equal(published.attempt.status, "succeeded");
  assert.equal(published.platformVersion.providerPostId, result().name);
  assert.equal(published.platformVersion.providerPostUrl, result().searchUrl);
  assert.equal(published.platformVersion.publishedRevision, 1);
  assert.deepEqual(f.events, ["health", "access", "create"]);
  await assert.rejects(f.server.publishGoogleBusinessVersion("version", 1), { name: "GoogleBusinessPublishConflictError" });
  assert.equal(f.events.filter(e => e === "create").length, 1);
});

test("concurrent submissions create one attempt and one remote post", async () => {
  const f = await fixture();
  const outcomes = await Promise.allSettled([f.server.publishGoogleBusinessVersion("version", 1), f.server.publishGoogleBusinessVersion("version", 1)]);
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(f.tables.publish_attempts.documents.length, 1);
  assert.equal(f.events.filter(e => e === "create").length, 1);
});

test("requires confirmed revision and rejects foreign client/account, media and inherited stale Master", async () => {
  for (const change of [
    f => { f.version.revision = 2; },
    f => { f.version.clientId = "other"; },
    f => { f.tables.social_connections.documents[0].providerParent = "accounts/999/locations/456"; },
    f => { f.version.mediaIds = ["image"]; },
    f => { f.tables.master_content.documents[0].revision = 2; },
    f => { f.version.ctaType = "CALL"; },
  ]) {
    const f = await fixture(); change(f);
    await assert.rejects(f.server.publishGoogleBusinessVersion("version", 1));
    assert.equal(f.events.includes("create"), false);
  }
  const f = await fixture();
  await assert.rejects(f.server.publishGoogleBusinessVersion("version"), /Confirm/);
});

test("access denial creates no attempt and cannot reach create; unhealthy renewal fails closed", async () => {
  const f = await fixture({ accessError: new Error("provider secret must not appear") });
  await assert.rejects(f.server.publishGoogleBusinessVersion("version", 1), /No post was submitted/);
  assert.equal(f.tables.publish_attempts.documents.length, 0);
  assert.equal(f.events.includes("create"), false);
  const bad = await fixture({ onHealth: tables => { tables.social_connections.documents[0].healthStatus = "permission_problem"; } });
  await assert.rejects(bad.server.publishGoogleBusinessVersion("version", 1), /health/);
});

test("an edit during preflight prevents create and exact revision claim", async () => {
  const f = await fixture({ onAccess: tables => { tables.platform_versions.documents[0].revision = 2; } });
  await assert.rejects(f.server.publishGoogleBusinessVersion("version", 1), /changed/);
  assert.equal(f.events.includes("create"), false);
  assert.equal(f.tables.publish_attempts.documents.length, 0);
});

test("processing result is pending and refresh only reads the same post", async () => {
  const f = await fixture({ state: "PROCESSING" });
  const pending = await f.server.publishGoogleBusinessVersion("version", 1);
  assert.equal(pending.attempt.status, "processing");
  assert.equal(pending.platformVersion.publishedRevision, undefined);
  await assert.rejects(f.server.publishGoogleBusinessVersion("version", 1), /recorded submission/);
  const live = await f.server.refreshGoogleBusinessPostStatus("version");
  assert.equal(live.platformVersion.publishedRevision, 1);
  assert.equal(live.attempt.status, "succeeded");
  assert.equal(f.events.filter(e => e === "create").length, 1);
  assert.equal(f.events.filter(e => e === "get").length, 1);
});

test("Google rejection retains provider identity and destination barrier", async () => {
  const f = await fixture({ state: "REJECTED" });
  const rejected = await f.server.publishGoogleBusinessVersion("version", 1);
  assert.equal(rejected.attempt.status, "rejected");
  assert.equal(rejected.platformVersion.publishedRevision, undefined);
  assert.equal(rejected.platformVersion.googlePublishLock, true);
  await assert.rejects(f.server.publishGoogleBusinessVersion("version", 1));
});

test("definitive rejection before acceptance allows deliberate retry; unknown outcomes stay locked", async () => {
  const known = Object.assign(new Error("secret body"), { name: "GoogleBusinessPublishApiError", status: 400 });
  const f = await fixture({ createError: known });
  await assert.rejects(f.server.publishGoogleBusinessVersion("version", 1), error => error.attempt.status === "failed");
  assert.equal(f.version.googlePublishLock, false);
  assert.equal(f.tables.publish_attempts.documents[0].submissionKey, undefined);
  await assert.rejects(f.server.publishGoogleBusinessVersion("version", 1));
  assert.equal(f.events.filter(e => e === "create").length, 2);
  for (const failure of [new Error("secret network error"), Object.assign(new Error("provider"), { name: "GoogleBusinessPublishApiError", status: 503 })]) {
    const u = await fixture({ createError: failure });
    await assert.rejects(u.server.publishGoogleBusinessVersion("version", 1), error => error.attempt.status === "unknown");
    assert.equal(u.version.googlePublishLock, true);
    assert.ok(u.tables.publish_attempts.documents[0].submissionKey);
    await assert.rejects(u.server.publishGoogleBusinessVersion("version", 1));
    assert.equal(u.events.filter(e => e === "create").length, 1);
  }
});

test("database failure after remote acceptance keeps lock and never re-creates a post", async () => {
  const f = await fixture({ onCreate: tables => {
    const original = tables.platform_versions.findOneAndUpdate;
    tables.platform_versions.findOneAndUpdate = async (...args) => {
      if (args[1].$set?.providerPostId) throw new Error("DB unavailable");
      return original(...args);
    };
  } });
  await assert.rejects(f.server.publishGoogleBusinessVersion("version", 1), /DB unavailable/);
  assert.equal(f.tables.publish_attempts.documents[0].providerPostId, result().name);
  assert.equal(f.version.googlePublishLock, true);
  await assert.rejects(f.server.publishGoogleBusinessVersion("version", 1));
  assert.equal(f.events.filter(e => e === "create").length, 1);
});

test("failed readback preserves pending lock without another create", async () => {
  const f = await fixture({ state: "PROCESSING", getError: new Error("private provider body") });
  await f.server.publishGoogleBusinessVersion("version", 1);
  await assert.rejects(f.server.refreshGoogleBusinessPostStatus("version"), /remains locked/);
  assert.equal(f.version.googlePublishLock, true);
  assert.equal(f.version.lastPublishStatus, "processing");
  assert.equal(f.events.filter(e => e === "create").length, 1);
});

test("saved provider success can repair local metadata through refresh after a database outage", async () => {
  let original;
  const f = await fixture({ onCreate: tables => {
    original = tables.platform_versions.findOneAndUpdate;
    tables.platform_versions.findOneAndUpdate = async (...args) => {
      if (args[1].$set?.providerPostId) throw new Error("DB unavailable");
      return original(...args);
    };
  } });
  await assert.rejects(f.server.publishGoogleBusinessVersion("version", 1));
  f.tables.platform_versions.findOneAndUpdate = original;
  const repaired = await f.server.refreshGoogleBusinessPostStatus("version");
  assert.equal(repaired.platformVersion.publishedRevision, 1);
  assert.equal(f.events.filter(e => e === "create").length, 1);
});

test("a late processing refresh cannot regress a concurrently recorded live result", async () => {
  const f = await fixture({ state: "PROCESSING", refreshedState: "PROCESSING" });
  await f.server.publishGoogleBusinessVersion("version", 1);
  const attempts = f.tables.publish_attempts;
  const original = attempts.findOneAndUpdate;
  attempts.findOneAndUpdate = async (...args) => {
    attempts.documents[0].status = "succeeded";
    attempts.documents[0].providerState = "LIVE";
    attempts.documents[0].completedAt = new Date();
    return original(...args);
  };
  const live = await f.server.refreshGoogleBusinessPostStatus("version");
  assert.equal(live.attempt.status, "succeeded");
  assert.equal(live.platformVersion.publishedRevision, 1);
});
