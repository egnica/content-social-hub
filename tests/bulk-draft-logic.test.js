import assert from "node:assert/strict";
import test from "node:test";
import {
  BULK_DRAFT_BATCH_SIZE, bulkDraftFingerprint,
  validateBulkDraftAccounts, validateBulkDraftMedia,
} from "../lib/bulk-draft-logic.js";

const connection = {
  _id: "account-a", clientId: "client-a", platform: "facebook", accountName: "Page A",
};
const row = {
  post_key: "one", title: "Example", master_text: "Hello", link_url: "https://example.org",
  media_url: "", local_date: "2027-01-10", local_time: "10:30",
  releaseAt: "2027-01-10T16:30:00.000Z",
  destinations: [{ account: { id: "account-a", name: "Page A", platform: "facebook" } }],
};

test("bulk drafts process bounded batches and fingerprint exact client/source/destinations", () => {
  assert.equal(BULK_DRAFT_BATCH_SIZE, 10);
  assert.equal(bulkDraftFingerprint("client-a", row), bulkDraftFingerprint("client-a", { ...row }));
  assert.notEqual(bulkDraftFingerprint("client-a", row), bulkDraftFingerprint("client-b", row));
  assert.notEqual(bulkDraftFingerprint("client-a", row), bulkDraftFingerprint("client-a", { ...row, master_text: "Changed" }));
  assert.notEqual(bulkDraftFingerprint("client-a", row), bulkDraftFingerprint("client-a", { ...row, local_time: "11:30" }));
  assert.notEqual(bulkDraftFingerprint("client-a", row), bulkDraftFingerprint("client-a", {
    ...row, destinations: [{ account: { id: "account-other" } }],
  }));
});

test("bulk draft account binding rejects changed or foreign destinations", () => {
  assert.deepEqual(validateBulkDraftAccounts(row, [connection], "client-a"), ["account-a"]);
  assert.throws(() => validateBulkDraftAccounts(row, [connection], "client-b"), /another client/);
  assert.throws(() => validateBulkDraftAccounts(row, [{ ...connection, accountName: "Renamed" }], "client-a"), /account changed/);
  assert.throws(() => validateBulkDraftAccounts(row, [{ ...connection, platform: "instagram" }], "client-a"), /account changed/);
});

test("bulk media type rules prevent mismatched Google, Instagram and YouTube drafts", () => {
  const image = { contentType: "image/jpeg", width: 800, height: 600 };
  const video = { contentType: "video/mp4", width: null, height: null };
  const googleRow = { ...row, destinations: [{ account: { platform: "google_business_profile" } }] };
  const youtubeRow = { ...row, destinations: [{ account: { platform: "youtube" } }] };
  const instagramRow = { ...row, destinations: [{ account: { platform: "instagram" } }] };
  assert.doesNotThrow(() => validateBulkDraftMedia(googleRow, image));
  assert.throws(() => validateBulkDraftMedia(googleRow, video), /requires an image/);
  assert.throws(() => validateBulkDraftMedia(googleRow, { ...image, width: 100 }), /250/);
  assert.throws(() => validateBulkDraftMedia(youtubeRow, image), /requires a video/);
  assert.doesNotThrow(() => validateBulkDraftMedia(youtubeRow, video));
  assert.doesNotThrow(() => validateBulkDraftMedia(instagramRow, image));
  assert.throws(() => validateBulkDraftMedia(instagramRow, { contentType: "video/webm" }), /supported image/);
});
