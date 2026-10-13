import test from "node:test";
import assert from "node:assert/strict";
import { summarizeYouTubeUploadDiagnostics } from "../lib/youtube-upload-diagnostics.js";

const NOW = Date.parse("2026-10-13T21:00:00Z");
const attempt = {
  _id: "507f1f77bcf86cd799439011",
  status: "uploading",
  platformVersionRevision: 3,
  uploadSessionEncrypted: "v1.TOP_SECRET_UPLOAD_SESSION",
  tokenEncrypted: "TOKEN_SHOULD_NOT_LEAK",
  bytesUploaded: 262144,
  uploadStepStartedAt: new Date(NOW - 4 * 60 * 1000),
  providerVideoId: "",
  providerError: "Internal error at https://example.com/secret?token=private",
  startedAt: new Date(NOW - 8 * 60 * 1000),
  updatedAt: new Date(NOW - 2 * 60 * 1000),
};
test("read-only diagnostics project only allowlisted metadata and redact provider URLs", () => {
  const result = summarizeYouTubeUploadDiagnostics(attempt, { size: 524288 }, NOW);
  assert.equal(result.status, "uploading");
  assert.equal(result.recordedBytes, 262144);
  assert.equal(result.expectedBytes, 524288);
  assert.equal(result.percentRecorded, 50);
  assert.equal(result.sessionState, "saved (not verified with YouTube)");
  assert.equal(result.stepState, "stale (eligible for session check)");
  assert.match(result.lastError, /\[URL redacted\]/);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("TOP_SECRET_UPLOAD_SESSION"), false);
  assert.equal(serialized.includes("TOKEN_SHOULD_NOT_LEAK"), false);
  assert.equal(serialized.includes("token=private"), false);
  assert.equal(Object.hasOwn(result, "uploadSessionEncrypted"), false);
  assert.equal(Object.hasOwn(result, "objectKey"), false);
});
test("diagnostics never claim provider verification from saved session presence", () => {
  const result = summarizeYouTubeUploadDiagnostics({ ...attempt,
    uploadStepStartedAt: null, providerVideoId: "abcdefghijk",
    providerStatus: { uploadStatus: "uploaded", processingStatus: "processing" },
    thumbnailStatus: "needs_review", thumbnailError: "Thumbnail not confirmed.",
  }, { size: 524288 }, NOW);
  assert.equal(result.stepState, "idle");
  assert.equal(result.videoUrl, "https://www.youtube.com/watch?v=abcdefghijk");
  assert.equal(result.providerUploadStatus, "uploaded");
  assert.equal(result.providerProcessingStatus, "processing");
  assert.equal(result.thumbnailStatus, "needs_review");
  assert.equal(result.thumbnailError, "Thumbnail not confirmed.");
  assert.equal(summarizeYouTubeUploadDiagnostics(null, null), null);
});
test("invalid or missing video and byte metadata are treated as unknown", () => {
  const result = summarizeYouTubeUploadDiagnostics({ ...attempt,
    bytesUploaded: -42, uploadSessionEncrypted: null, providerVideoId: "invalid",
  }, null, NOW);
  assert.equal(result.recordedBytes, 0);
  assert.equal(result.expectedBytes, null);
  assert.equal(result.percentRecorded, null);
  assert.equal(result.sessionState, "not saved");
  assert.equal(result.videoUrl, null);
});
