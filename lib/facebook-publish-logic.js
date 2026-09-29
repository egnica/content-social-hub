import {
  uniqueStringIds,
  validateFacebookVersionDraft,
} from "./platform-version-logic.js";

export function validateFacebookTextLinkPublishDraft(input = {}) {
  const base = validateFacebookVersionDraft(input);
  const blocking = [...base.blocking];

  if (uniqueStringIds(input.mediaIds || []).length > 0) {
    blocking.push(
      "Remove selected media before publishing. Image and video publishing are not enabled yet.",
    );
  }

  return {
    ...base,
    blocking,
    publishable: blocking.length === 0,
  };
}

export function buildFacebookFeedPayload({ message = "", destinationUrl = "" } = {}) {
  const normalizedMessage = String(message || "").trim();
  const normalizedLink = String(destinationUrl || "").trim();
  const payload = {};

  if (normalizedMessage) payload.message = normalizedMessage;
  if (normalizedLink) payload.link = normalizedLink;

  return payload;
}

export function createFacebookSubmissionKey(platformVersionId, revision) {
  const versionId = String(platformVersionId || "").trim();
  const versionRevision = Number(revision);

  if (!versionId || !Number.isInteger(versionRevision) || versionRevision < 1) {
    throw new TypeError("A saved Facebook version and revision are required.");
  }

  return `facebook:${versionId}:revision:${versionRevision}`;
}

export function buildFacebookPostUrl(pageId, providerPostId) {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedPostId = String(providerPostId || "").trim();

  if (!normalizedPageId || !normalizedPostId) return "";

  const postObjectId = normalizedPostId.includes("_")
    ? normalizedPostId.split("_").at(-1)
    : normalizedPostId;

  return `https://www.facebook.com/${encodeURIComponent(normalizedPageId)}/posts/${encodeURIComponent(postObjectId)}`;
}

function sanitizeText(value, maxLength = 1000) {
  return String(value || "")
    .replace(/([?&](?:access_token|appsecret_proof)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\b(?:access_token|appsecret_proof)\s*[:=]\s*[^\s,}]+/gi, (match) => {
      const separator = match.includes(":") ? ":" : "=";
      const name = match.split(/[:=]/, 1)[0];
      return `${name}${separator}[redacted]`;
    })
    .slice(0, maxLength);
}


export function isDefinitiveFacebookProviderFailure(error) {
  const details = error?.details;

  return Boolean(
    error?.name === "FacebookApiError" &&
      details &&
      typeof details === "object" &&
      (details.code !== undefined || details.type || details.message),
  );
}

export function sanitizeFacebookProviderError(error) {
  const details = error?.details || {};

  return {
    name: sanitizeText(error?.name || "FacebookApiError", 120),
    message: sanitizeText(error?.message || "Facebook publishing failed."),
    code: Number.isFinite(Number(details.code)) ? Number(details.code) : null,
    type: sanitizeText(details.type || "", 120),
    errorSubcode: Number.isFinite(Number(details.error_subcode))
      ? Number(details.error_subcode)
      : null,
    isTransient: details.is_transient === true,
    userTitle: sanitizeText(details.error_user_title || "", 240),
    userMessage: sanitizeText(details.error_user_msg || "", 600),
    traceId: sanitizeText(details.fbtrace_id || "", 240),
  };
}
