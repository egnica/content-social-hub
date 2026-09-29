import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFacebookFeedPayload,
  buildFacebookPostUrl,
  createFacebookSubmissionKey,
  isDefinitiveFacebookProviderFailure,
  sanitizeFacebookProviderError,
  validateFacebookTextLinkPublishDraft,
} from "../lib/facebook-publish-logic.js";

test("text/link publish validation accepts a healthy saved text-link draft", () => {
  const result = validateFacebookTextLinkPublishDraft({
    message: "New post",
    destinationUrl: "https://example.com/post",
    mediaIds: [],
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(result.publishable, true);
  assert.deepEqual(result.blocking, []);
});

test("text/link publisher blocks selected media rather than silently dropping it", () => {
  const result = validateFacebookTextLinkPublishDraft({
    message: "New post",
    destinationUrl: "https://example.com/post",
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
