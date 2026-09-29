import assert from "node:assert/strict";
import test from "node:test";
import {
  FACEBOOK_MAX_IMAGE_BYTES,
  FACEBOOK_MAX_VIDEO_BYTES,
  buildFacebookFeedPayload,
  buildFacebookImagePostMessage,
  buildFacebookPostUrl,
  buildFacebookVideoDescription,
  buildFacebookVideoUrl,
  createFacebookSubmissionKey,
  isDefinitiveFacebookProviderFailure,
  normalizeFacebookVideoProcessingStatus,
  orderFacebookImageAssets,
  sanitizeFacebookProviderError,
  validateFacebookPublishDraft,
  validateFacebookTextLinkPublishDraft,
} from "../lib/facebook-publish-logic.js";

test("Facebook publish validation accepts a healthy saved text-link draft", () => {
  const result = validateFacebookPublishDraft({
    message: "New post",
    destinationUrl: "https://example.com/post",
    mediaIds: [],
    mediaAssets: [],
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(result.publishable, true);
  assert.equal(result.publishMode, "text_link");
  assert.deepEqual(result.blocking, []);
});

test("Facebook publish validation accepts selected supported images", () => {
  const result = validateFacebookPublishDraft({
    message: "Photo post",
    mediaIds: ["media-1", "media-2"],
    mediaAssets: [
      { _id: "media-1", contentType: "image/jpeg", size: 500_000 },
      { _id: "media-2", contentType: "image/png", size: 900_000 },
    ],
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(result.publishable, true);
  assert.equal(result.publishMode, "image");
  assert.deepEqual(result.blocking, []);
});

test("Facebook publish validation accepts one supported video", () => {
  const result = validateFacebookPublishDraft({
    message: "Video post",
    mediaIds: ["video-1"],
    mediaAssets: [
      { _id: "video-1", contentType: "video/mp4", size: 5_000_000 },
    ],
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(result.publishable, true);
  assert.equal(result.publishMode, "video");
  assert.deepEqual(result.blocking, []);
});

test("Facebook video publisher blocks multiple videos", () => {
  const result = validateFacebookPublishDraft({
    mediaIds: ["video-1", "video-2"],
    mediaAssets: [
      { _id: "video-1", contentType: "video/mp4", size: 5_000_000 },
      { _id: "video-2", contentType: "video/quicktime", size: 6_000_000 },
    ],
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(result.publishable, false);
  assert.match(result.blocking.join(" "), /one video per post/);
});

test("Facebook video publisher blocks mixed image and video attachments", () => {
  const result = validateFacebookPublishDraft({
    mediaIds: ["video-1", "image-1"],
    mediaAssets: [
      { _id: "video-1", contentType: "video/mp4", size: 5_000_000 },
      { _id: "image-1", contentType: "image/jpeg", size: 500_000 },
    ],
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(result.publishable, false);
  assert.match(result.blocking.join(" "), /cannot mix a video with image/);
});

test("Facebook video publisher blocks unsupported types and files over 2 GB", () => {
  const unsupported = validateFacebookPublishDraft({
    mediaIds: ["video-1"],
    mediaAssets: [
      { _id: "video-1", contentType: "video/webm", size: 5_000_000 },
    ],
    healthStatus: "healthy",
    canPublish: true,
  });
  const oversized = validateFacebookPublishDraft({
    mediaIds: ["video-1"],
    mediaAssets: [
      {
        _id: "video-1",
        contentType: "video/mp4",
        size: FACEBOOK_MAX_VIDEO_BYTES + 1,
      },
    ],
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(unsupported.publishable, false);
  assert.match(unsupported.blocking.join(" "), /MP4, MOV, or M4V/);
  assert.equal(oversized.publishable, false);
  assert.match(oversized.blocking.join(" "), /2 GB or smaller/);
});

test("Facebook image publisher blocks unsupported image types and files over 10 MB", () => {
  const result = validateFacebookPublishDraft({
    mediaIds: ["media-1", "media-2"],
    mediaAssets: [
      { _id: "media-1", contentType: "image/webp", size: 100_000 },
      {
        _id: "media-2",
        contentType: "image/jpeg",
        size: FACEBOOK_MAX_IMAGE_BYTES + 1,
      },
    ],
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(result.publishable, false);
  assert.match(result.blocking.join(" "), /JPEG, BMP, PNG, GIF, or TIFF/);
  assert.match(result.blocking.join(" "), /10 MB or smaller/);
});

test("server validation blocks a selected media id that cannot be resolved", () => {
  const result = validateFacebookPublishDraft({
    mediaIds: ["media-1", "missing"],
    mediaAssets: [
      { _id: "media-1", contentType: "image/jpeg", size: 100_000 },
    ],
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(result.publishable, false);
  assert.match(result.blocking.join(" "), /no longer available/);
});

test("legacy text-link validation still blocks selected media", () => {
  const result = validateFacebookTextLinkPublishDraft({
    message: "New post",
    mediaIds: ["media-1"],
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(result.publishable, false);
  assert.match(result.blocking.at(-1), /Remove selected media/);
});

test("Facebook feed payload omits blank values", () => {
  assert.deepEqual(buildFacebookFeedPayload({ message: " Hello ", destinationUrl: "" }), {
    message: "Hello",
  });
  assert.deepEqual(buildFacebookFeedPayload({ message: "", destinationUrl: " https://example.com/a " }), {
    link: "https://example.com/a",
  });
});

test("image posts preserve destination URLs in post text without duplicating them", () => {
  assert.equal(
    buildFacebookImagePostMessage({
      message: "Photo update",
      destinationUrl: "https://example.com/a",
    }),
    "Photo update\n\nhttps://example.com/a",
  );
  assert.equal(
    buildFacebookImagePostMessage({
      message: "Photo update https://example.com/a",
      destinationUrl: "https://example.com/a",
    }),
    "Photo update https://example.com/a",
  );
});

test("video descriptions preserve destination URLs without duplicating them", () => {
  assert.equal(
    buildFacebookVideoDescription({
      message: "Video update",
      destinationUrl: "https://example.com/a",
    }),
    "Video update\n\nhttps://example.com/a",
  );
});

test("primary image is uploaded first while remaining selected order is preserved", () => {
  const ordered = orderFacebookImageAssets(
    [
      { _id: "one" },
      { _id: "two" },
      { _id: "three" },
    ],
    "two",
  );

  assert.deepEqual(ordered.map((asset) => asset._id), ["two", "one", "three"]);
});

test("submission key is stable for one platform-version revision", () => {
  assert.equal(
    createFacebookSubmissionKey("version-123", 7),
    "facebook:version-123:revision:7",
  );
  assert.throws(() => createFacebookSubmissionKey("", 7), TypeError);
});

test("Facebook post URL is recovered from page and provider post ids", () => {
  assert.equal(
    buildFacebookPostUrl("123", "123_456"),
    "https://www.facebook.com/123/posts/456",
  );
});

test("Facebook video URL is recoverable from page and video ids", () => {
  assert.equal(
    buildFacebookVideoUrl("123", "789"),
    "https://www.facebook.com/123/videos/789",
  );
});

test("video processing status normalizes ready, failed, and in-progress states", () => {
  assert.equal(
    normalizeFacebookVideoProcessingStatus({
      status: { video_status: "ready" },
    }),
    "succeeded",
  );
  assert.equal(
    normalizeFacebookVideoProcessingStatus({
      status: { processing_phase: { status: "error" } },
    }),
    "failed",
  );
  assert.equal(
    normalizeFacebookVideoProcessingStatus({
      status: { processing_phase: { status: "complete" } },
    }),
    "processing",
  );
  assert.equal(
    normalizeFacebookVideoProcessingStatus({
      status: { publishing_phase: { status: "complete" } },
    }),
    "succeeded",
  );
});

test("provider errors retain useful fields while redacting secrets", () => {
  const error = new Error(
    "Request failed?access_token=secret-token&appsecret_proof=secret-proof",
  );
  error.name = "FacebookApiError";
  error.details = {
    code: 200,
    type: "OAuthException",
    error_subcode: 99,
    is_transient: false,
    error_user_title: "Permission problem",
    error_user_msg: "Reconnect the Page",
    fbtrace_id: "trace-123",
  };

  const sanitized = sanitizeFacebookProviderError(error);
  assert.equal(sanitized.code, 200);
  assert.equal(sanitized.type, "OAuthException");
  assert.doesNotMatch(sanitized.message, /secret-token|secret-proof/);
  assert.match(sanitized.message, /\[redacted\]/);
});

test("Graph API rejections are definitive but transport failures remain ambiguous", () => {
  const graphError = new Error("Permission denied");
  graphError.name = "FacebookApiError";
  graphError.details = { code: 200, type: "OAuthException", message: "Permission denied" };

  assert.equal(isDefinitiveFacebookProviderFailure(graphError), true);
  assert.equal(isDefinitiveFacebookProviderFailure(new TypeError("network failed")), false);

  const missingId = new Error("Facebook accepted the request but did not return a post ID.");
  missingId.name = "FacebookApiError";
  missingId.details = null;
  assert.equal(isDefinitiveFacebookProviderFailure(missingId), false);
});
