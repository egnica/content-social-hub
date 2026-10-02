import assert from "node:assert/strict";
import test from "node:test";
import { fakeCollection } from "./helpers/fake-mongo.js";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import { renewInstagramConnection, INSTAGRAM_RENEWAL_WINDOW_MS, INSTAGRAM_RENEWAL_RETRY_MS } from "../lib/instagram-token-maintenance.js";
import { getInstagramHealth } from "../lib/instagram-connection-logic.js";
import { INSTAGRAM_RECOVERY_IDLE_MS } from "../lib/instagram-recovery-logic.js";

const scopes = ["instagram_business_basic", "instagram_business_content_publish"];

test("Account Health renews before computing health and returns no encrypted credential", async () => {
  const now = new Date();
  const connections = fakeCollection([{
    _id: "connection", clientId: "client", platform: "instagram", providerAccountId: "ig-account",
    grantedScopes: scopes, tokenEncrypted: "old-encrypted", tokenExpiresAt: new Date(+now + 86_400_000), createdAt: new Date(+now - 59 * 86_400_000),
  }]);
  const fallback = fakeCollection();
  const server = await loadWithStubs(new URL("../lib/connections.js", import.meta.url), {
    getDb: async () => ({ collection: (name) => name === "social_connections" ? connections : fallback }),
    toObjectId: (id) => id, serializeDocument: (doc) => structuredClone(doc),
    renewInstagramConnection, getInstagramHealth,
    decryptSecret: (value) => { assert.equal(value, "old-encrypted"); return "old-token"; },
    encryptSecret: (value) => { assert.equal(value, "renewed-token"); return "new-encrypted"; },
    refreshInstagramAccessToken: async () => ({ accessToken: "renewed-token", expiresAt: new Date(+now + 60 * 86_400_000) }),
    getInstagramProfile: async (token) => { assert.equal(token, "renewed-token"); return { providerAccountId: "ig-account", username: "name", accountName: "@name", accountType: "BUSINESS" }; },
  });
  const result = await server.refreshSocialConnectionHealth("connection");
  assert.equal(result.healthStatus, "healthy");
  assert.equal(result.capabilities.canPublish, true);
  assert.equal(result.tokenEncrypted, undefined);
  assert.equal(connections.documents[0].tokenEncrypted, "new-encrypted");
});

test("periodic maintenance bounds work and excludes fresh, inactive and non-Instagram releases", async () => {
  const old = new Date(Date.now() - 30 * 60_000);
  const connections = fakeCollection([
    { _id: "ig", platform: "instagram", tokenExpiresAt: new Date(Date.now() + 86_400_000), lastHealthCheckAt: null },
    { _id: "future", platform: "instagram", tokenExpiresAt: new Date(Date.now() + 60 * 86_400_000), lastHealthCheckAt: null },
    { _id: "fb", platform: "facebook", tokenExpiresAt: old, lastHealthCheckAt: null },
  ]);
  const schedules = fakeCollection([
    { _id: "idle", platform: "instagram", state: "dispatching", active: true, updatedAt: old },
    { _id: "other-idle", platform: "instagram", state: "dispatching", active: true, updatedAt: old },
    { _id: "fresh", platform: "instagram", state: "dispatching", active: true, updatedAt: new Date() },
    { _id: "scheduled", platform: "instagram", state: "scheduled", active: true, updatedAt: old },
    { _id: "cancelled", platform: "instagram", state: "cancelled", active: false, updatedAt: old },
    { _id: "fb", platform: "facebook", state: "dispatching", active: true, updatedAt: old },
  ]);
  const checked = [], recovered = [];
  const server = await loadWithStubs(new URL("../lib/instagram-maintenance.js", import.meta.url), {
    getDb: async () => ({ collection: (name) => name === "social_connections" ? connections : schedules }),
    INSTAGRAM_RENEWAL_WINDOW_MS, INSTAGRAM_RENEWAL_RETRY_MS, INSTAGRAM_RECOVERY_IDLE_MS,
    refreshSocialConnectionHealth: async (id) => { checked.push(id); return { healthStatus: "healthy", tokenRenewedAt: new Date() }; },
    recoverScheduledInstagramRelease: async (id) => { recovered.push(id); return { outcome: "succeeded" }; },
  });
  const result = await server.runInstagramMaintenance();
  assert.deepEqual(checked, ["ig"]);
  assert.equal(recovered.length, 1);
  assert.equal(result.connectionsChecked, 1);
  assert.equal(result.recovered, 1);
  assert.equal(result.errors, 0);
});

test("review-required releases block editing and manual publishing; normal resolved releases remain usable", async () => {
  const schedules = fakeCollection([{ _id: "schedule", platformVersionId: "version", active: true, state: "review_required" }]);
  const server = await loadWithStubs(new URL("../lib/scheduled-release-guard.js", import.meta.url), {
    getDb: async () => ({ collection: () => schedules }), toObjectId: (id) => id,
  });
  await assert.rejects(server.assertDestinationNotDispatching("version"), /awaiting review/);
  await assert.rejects(server.assertDestinationNotAwaitingReview("version"), /unresolved/);
  schedules.documents[0].active = false;
  await server.assertDestinationNotDispatching("version");
  await server.assertDestinationNotAwaitingReview("version");
});

test("all three Instagram publishers reload the renewed credential before provider submission", async () => {
  for (const mode of ["single_image", "carousel", "reel"]) {
    const connection = { _id: "connection", clientId: "client", platform: "instagram", providerAccountId: "ig-account", tokenEncrypted: "old-encrypted", healthStatus: "healthy", capabilities: { canPublish: true } };
    const connections = fakeCollection([structuredClone(connection)]);
    const version = { _id: "version", platform: "instagram", clientId: "client", socialConnectionId: "connection", masterContentId: "master", revision: 1, mediaIds: ["asset"], mediaMode: mode === "reel" ? "reel" : "single_image" };
    const asset = { _id: "asset", clientId: "client", status: "uploaded", contentType: mode === "reel" ? "video/mp4" : "image/jpeg", objectKey: "private-key" };
    const attempts = fakeCollection();
    attempts.insertOne = async (doc) => { attempts.documents.push({ ...doc, _id: "attempt" }); return { insertedId: "attempt" }; };
    const versions = fakeCollection([version]);
    const master = { _id: "master", clientId: "client" };
    let credential;
    const context = { connection: structuredClone(connection), connections, version, master, selectedMediaIds: version.mediaIds, orderedMedia: [asset], media: fakeCollection([asset]), platformVersions: versions, publishAttempts: attempts };
    const stubs = {
      refreshSocialConnectionHealth: async () => {
        connections.documents[0].tokenEncrypted = "new-encrypted";
        return { healthStatus: "healthy", capabilities: { canPublish: true } };
      },
      getDb: async () => ({ collection: (name) => ({ social_connections: connections, master_content: fakeCollection([master]), platform_versions: versions, media_assets: context.media, publish_attempts: attempts })[name] }),
      loadInstagramCarouselPublishContext: async () => context,
      toObjectId: (id) => id, serializeDocument: (value) => value,
      validateInstagramSingleImagePublishDraft: () => ({ publishable: true }),
      validateInstagramCarouselPublishDraft: () => ({ publishable: true }),
      validateInstagramReelPublishDraft: () => ({ publishable: true }),
      instagramCarouselMediaView: (value) => value,
      ensureInstagramImageAsset: async (value) => value,
      resolveInstagramReelCoverMediaId: () => "",
      createInstagramSubmissionKey: () => "key",
      createCarouselPublishAttempt: async () => ({ _id: "attempt" }),
      decryptSecret: (encrypted) => { credential = encrypted; throw new Error("stop-before-live-provider-call"); },
    };
    const file = mode === "single_image" ? "instagram-publishing" : mode === "carousel" ? "instagram-carousel-publishing" : "instagram-reel-publishing";
    const server = await loadWithStubs(new URL(`../lib/${file}.js`, import.meta.url), stubs);
    const publish = mode === "single_image" ? server.publishInstagramSingleImageVersion : mode === "carousel" ? server.publishInstagramCarouselVersion : server.publishInstagramReelVersion;
    await assert.rejects(publish("version"), /stop-before-live-provider-call/);
    assert.equal(credential, "new-encrypted", mode);
  }
});
