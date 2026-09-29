import {
  uniqueStringIds,
  validateFacebookVersionDraft,
} from "./platform-version-logic.js";

export const FACEBOOK_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const FACEBOOK_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/bmp",
  "image/png",
  "image/gif",
  "image/tiff",
]);

function mediaId(asset) {
  return String(asset?._id || asset?.id || "").trim();
}

export function validateFacebookPublishDraft(input = {}) {
  const base = validateFacebookVersionDraft(input);
  const blocking = [...base.blocking];
  const selectedIds = uniqueStringIds(input.mediaIds || []);
  const suppliedAssets = Array.isArray(input.mediaAssets) ? input.mediaAssets : [];

  if (selectedIds.length && suppliedAssets.length) {
    const assetsById = new Map(
      suppliedAssets
        .map((asset) => [mediaId(asset), asset])
        .filter(([id]) => Boolean(id)),
    );

    for (const id of selectedIds) {
      const asset = assetsById.get(id);

      if (!asset) {
        blocking.push("One or more selected media files are no longer available.");
        continue;
      }

      const contentType = String(asset.contentType || "").toLowerCase();
      const size = Number(asset.size || 0);

      if (contentType.startsWith("video/")) {
        blocking.push(
          "Video publishing is not enabled yet. Remove videos before publishing.",
        );
        continue;
      }

      if (!FACEBOOK_IMAGE_CONTENT_TYPES.has(contentType)) {
        blocking.push(
          "Facebook image publishing supports JPEG, BMP, PNG, GIF, or TIFF files.",
        );
      }

      if (!Number.isFinite(size) || size <= 0 || size > FACEBOOK_MAX_IMAGE_BYTES) {
        blocking.push("Facebook image files must be 10 MB or smaller.");
      }
    }
  }

  return {
    ...base,
    blocking: [...new Set(blocking)],
    publishable: blocking.length === 0,
    publishMode: selectedIds.length ? "image" : "text_link",
  };
}

export function validateFacebookTextLinkPublishDraft(input = {}) {
  const result = validateFacebookPublishDraft(input);
  const blocking = [...result.blocking];

  if (uniqueStringIds(input.mediaIds || []).length > 0) {
    blocking.push(
      "Remove selected media before publishing. Image and video publishing are not enabled yet.",
    );
  }

  return {
    ...result,
    blocking: [...new Set(blocking)],
    publishable: blocking.length === 0,
    publishMode: "text_link",
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

export function buildFacebookImagePostMessage({
  message = "",
  destinationUrl = "",
} = {}) {
  const normalizedMessage = String(message || "").trim();
  const normalizedLink = String(destinationUrl || "").trim();

  if (!normalizedLink) return normalizedMessage;
  if (normalizedMessage.includes(normalizedLink)) return normalizedMessage;
  if (!normalizedMessage) return normalizedLink;

  return `${normalizedMessage}\n\n${normalizedLink}`;
}

export function orderFacebookImageAssets(assets = [], primaryMediaId = "") {
  const normalized = Array.isArray(assets) ? assets.filter(Boolean) : [];
  const primaryId = String(primaryMediaId || "").trim();

  if (!primaryId) return normalized;

  const primaryIndex = normalized.findIndex((asset) => mediaId(asset) === primaryId);
  if (primaryIndex <= 0) return normalized;

  return [
    normalized[primaryIndex],
    ...normalized.slice(0, primaryIndex),
    ...normalized.slice(primaryIndex + 1),
  ];
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
