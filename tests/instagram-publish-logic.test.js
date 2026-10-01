import assert from "node:assert/strict";
import test from "node:test";
import {
  createInstagramSubmissionKey,
  getInstagramPublishControlState,
  isDefinitiveInstagramProviderFailure,
  isInstagramAttemptForRevision,
  normalizeInstagramContainerStatus,
  normalizeInstagramProviderUrl,
  sanitizeInstagramProviderError,
  validateInstagramSingleImagePublishDraft,
} from "../lib/instagram-publish-logic.js";

const jpeg = {
  _id: "image-1",
  contentType: "image/jpeg",
  size: 500_000,
  width: 1080,
  height: 1350,
};

test("single-image Instagram publish validation accepts a healthy JPEG", () => {
  const result = validateInstagramSingleImagePublishDraft({
    caption: "Hello Instagram",
    mediaIds: ["image-1"],
    mediaAssets: [jpeg],
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(result.publishable, true);
  assert.equal(result.publishMode, "single_image");
  assert.equal(result.selectedAsset._id, "image-1");
  assert.equal(result.needsJpegDerivative, false);
});

test("single-image validation accepts PNG and marks it for automatic JPEG conversion", () => {
  const result = validateInstagramSingleImagePublishDraft({
    mediaIds: ["png"],
    mediaAssets: [{ ...jpeg, _id: "png", contentType: "image/png" }],
  });

  assert.equal(result.publishable, true);
  assert.equal(result.needsJpegDerivative, true);
});

test("single-image validation blocks unsupported image types and invalid ratio files", () => {
  const unsupported = validateInstagramSingleImagePublishDraft({
    mediaIds: ["bad"],
    mediaAssets: [{ ...jpeg, _id: "bad", contentType: "image/gif" }],
  });
  const ratio = validateInstagramSingleImagePublishDraft({
    mediaIds: ["wide"],
    mediaAssets: [{ ...jpeg, _id: "wide", width: 2000, height: 500 }],
  });

  assert.equal(unsupported.publishable, false);
  assert.match(unsupported.blocking.join(" "), /PNG, WebP, and AVIF/);
  assert.equal(ratio.publishable, false);
  assert.match(ratio.blocking.join(" "), /aspect ratio/);
});

test("single-image validation blocks unhealthy destinations and overlong captions", () => {
  const result = validateInstagramSingleImagePublishDraft({
    caption: "x".repeat(2201),
    mediaIds: ["image-1"],
    mediaAssets: [jpeg],
    healthStatus: "expired",
    canPublish: false,
  });

  assert.equal(result.publishable, false);
  assert.equal(result.blocking.length, 2);
});

test("submission keys are provider and revision specific", () => {
  assert.equal(
    createInstagramSubmissionKey("version-1", 4),
    "instagram:version-1:revision:4",
  );
  assert.throws(() => createInstagramSubmissionKey("", 4));
});

test("container status normalization keeps unfinished work processing", () => {
  assert.equal(normalizeInstagramContainerStatus({ status_code: "FINISHED" }), "finished");
  assert.equal(normalizeInstagramContainerStatus({ status_code: "ERROR" }), "failed");
  assert.equal(normalizeInstagramContainerStatus({ status_code: "IN_PROGRESS" }), "processing");
});

test("provider URL normalization only allows Instagram HTTPS links", () => {
  assert.match(normalizeInstagramProviderUrl("https://www.instagram.com/p/abc/"), /instagram\.com/);
  assert.equal(normalizeInstagramProviderUrl("https://example.com/p/abc/"), "");
  assert.equal(normalizeInstagramProviderUrl("javascript:alert(1)"), "");
});

test("provider errors are sanitized and explicit Instagram API errors are definitive", () => {
  const error = new Error("Bad token access_token=secret");
  error.name = "InstagramApiError";
  error.details = { code: 190, message: "expired", fbtrace_id: "trace" };

  assert.equal(isDefinitiveInstagramProviderFailure(error), true);
  const safe = sanitizeInstagramProviderError(error);
  assert.equal(safe.code, 190);
  assert.doesNotMatch(safe.message, /secret/);
});

test("publish control state locks successful and uncertain revisions", () => {
  assert.equal(
    getInstagramPublishControlState({ status: "succeeded", publishedRevision: 2, revision: 2 }).mode,
    "published",
  );
  assert.equal(getInstagramPublishControlState({ status: "unknown", revision: 2 }).mode, "locked");
  assert.equal(getInstagramPublishControlState({ status: "failed", revision: 2 }).canSubmit, true);
  assert.equal(isInstagramAttemptForRevision({ platformVersionRevision: 2 }, 2), true);
});
