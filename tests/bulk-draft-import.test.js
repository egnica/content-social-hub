import assert from "node:assert/strict";
import test from "node:test";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import {
  bulkDraftFingerprint, validateBulkDraftAccounts, validateBulkDraftMedia,
} from "../lib/bulk-draft-logic.js";

const clientId = "client-a";
const connection = {
  _id: "account-a", clientId, accountName: "Page A", platform: "facebook",
  healthStatus: "healthy", capabilities: { canPublish: true },
};
const post = {
  row: 3, post_key: "post-one", title: "Example", master_text: "Hello",
  link_url: "https://example.org", media_url: "", local_date: "2027-01-10",
  local_time: "10:30", releaseAt: "2027-01-10T16:30:00.000Z",
  destinations: [{ account: { id: "account-a", name: "Page A", platform: "facebook" } }],
};

async function setup({ previous = null, failSyncOnce = false, failDownload = false } = {}) {
  const calls = { masters: [], media: [], sync: [] };
  let imported = previous;
  let syncFailures = failSyncOnce ? 1 : 0;
  const importer = await loadWithStubs(new URL("../lib/bulk-draft-import.js", import.meta.url), {
    createContent: async (data, { bulkImport }) => {
      calls.masters.push({ data, bulkImport });
      imported = { _id: "master-one", bulkImport };
      return imported;
    },
    getImportedBulkContent: async () => imported,
    downloadBulkMedia: async (url) => {
      calls.media.push({ action: "download", url });
      if (failDownload) throw new TypeError("Media unavailable.");
      return { contentType: "image/jpeg", extension: "jpg", bytes: Buffer.from("media"), width: 800, height: 600 };
    },
    saveBulkMedia: async () => {
      calls.media.push({ action: "save" });
      return { _id: "media-one" };
    },
    bulkDraftFingerprint,
    validateBulkDraftAccounts,
    validateBulkDraftMedia,
    isEditableGoogleBusinessConnection: () => false,
    isPublishableSocialConnection: (account, id) => account?.clientId === id &&
      account?.healthStatus === "healthy" && account?.capabilities?.canPublish === true,
    syncPlatformVersionSelection: async (masterId, accountIds) => {
      calls.sync.push({ masterId, accountIds });
      if (syncFailures-- > 0) throw new Error("Temporary destination storage problem");
    },
    validateContentInput: (value) => ({ data: value, errors: {} }),
    hasValidationErrors: (errors) => Object.keys(errors).length > 0,
  });
  return { importer, calls };
}

test("reviewed text/link row creates a Master draft and exact destination versions, not a schedule", async () => {
  const { importer, calls } = await setup();
  const result = await importer.importBulkDraftRow(post, clientId, [connection]);
  assert.equal(result.status, "created");
  assert.equal(result.contentId, "master-one");
  assert.equal(calls.masters.length, 1);
  assert.equal(calls.masters[0].data.defaultReleaseAt, "2027-01-10T10:30");
  assert.equal(calls.masters[0].data.primaryUrl, post.link_url);
  assert.deepEqual(calls.sync, [{ masterId: "master-one", accountIds: ["account-a"] }]);
  assert.deepEqual(calls.media, []);
});

test("identical post_key and source reuses the original Master without a second insert", async () => {
  const previous = { _id: "master-existing", bulkImport: {
    key: post.post_key, fingerprint: bulkDraftFingerprint(clientId, post),
  } };
  const { importer, calls } = await setup({ previous });
  const result = await importer.importBulkDraftRow(post, clientId, [connection]);
  assert.equal(result.status, "existing");
  assert.equal(result.contentId, "master-existing");
  assert.equal(calls.masters.length, 0);
  assert.equal(calls.sync.length, 1);
});

test("changing content under a reused post_key fails closed", async () => {
  const previous = { _id: "master-existing", bulkImport: {
    key: post.post_key, fingerprint: bulkDraftFingerprint(clientId, post),
  } };
  const { importer, calls } = await setup({ previous });
  await assert.rejects(importer.importBulkDraftRow(
    { ...post, master_text: "Changed" }, clientId, [connection],
  ), /post_key was already used/);
  assert.equal(calls.masters.length, 0);
});

test("remote media is checked then saved privately before the Master records its ID", async () => {
  const mediaPost = { ...post, media_url: "https://cdn.example.org/photo.jpg" };
  const { importer, calls } = await setup();
  await importer.importBulkDraftRow(mediaPost, clientId, [connection]);
  assert.deepEqual(calls.media.map((item) => item.action), ["download", "save"]);
  assert.deepEqual(calls.masters[0].data.mediaIds, ["media-one"]);
  assert.equal(calls.masters[0].data.defaultPrimaryMediaId, "media-one");
});

test("unavailable media and unhealthy accounts fail without creating a Master", async () => {
  const mediaPost = { ...post, media_url: "https://cdn.example.org/photo.jpg" };
  const failed = await setup({ failDownload: true });
  await assert.rejects(failed.importer.importBulkDraftRow(mediaPost, clientId, [connection]), /unavailable/);
  assert.equal(failed.calls.masters.length, 0);
  const disconnected = await setup();
  await assert.rejects(disconnected.importer.importBulkDraftRow(
    post, clientId, [{ ...connection, healthStatus: "expired" }],
  ), /not healthy/);
  assert.equal(disconnected.calls.masters.length, 0);
});

test("an interrupted destination-version write resumes the same Master on retry", async () => {
  const { importer, calls } = await setup({ failSyncOnce: true });
  await assert.rejects(importer.importBulkDraftRow(post, clientId, [connection]), /Temporary destination/);
  const result = await importer.importBulkDraftRow(post, clientId, [connection]);
  assert.equal(result.status, "existing");
  assert.equal(calls.masters.length, 1);
  assert.equal(calls.sync.length, 2);
});
