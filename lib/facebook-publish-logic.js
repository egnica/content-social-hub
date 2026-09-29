import {
  uniqueStringIds,
  validateFacebookVersionDraft,
} from "./platform-version-logic.js";

export const FACEBOOK_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const FACEBOOK_MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

const FACEBOOK_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/bmp",
  "image/png",
  "image/gif",
  "image/tiff",
]);

const FACEBOOK_VIDEO_CONTENT_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
]);

function mediaId(asset) {
  return String(asset?._id || asset?.id || "").trim();
}

function mediaType(asset) {
  return String(asset?.contentType || "").toLowerCase();
}

function validateFacebookImageAsset(asset, blocking, { thumbnail = false } = {}) {
  const contentType = mediaType(asset);
  const size = Number(asset?.size || 0);

  if (!FACEBOOK_IMAGE_CONTENT_TYPES.has(contentType)) {
    blocking.push(
      thumbnail
        ? "Facebook video thumbnails must be JPEG, BMP, PNG, GIF, or TIFF files."
        : "Facebook image publishing supports JPEG, BMP, PNG, GIF, or TIFF files.",
    );
  }

  if (!Number.isFinite(size) || size <= 0 || size > FACEBOOK_MAX_IMAGE_BYTES) {
    blocking.push(
      thumbnail
        ? "Facebook video thumbnail files must be 10 MB or smaller."
        : "Facebook image files must be 10 MB or smaller.",
    );
  }
}

export function validateFacebookPublishDraft(input = {}) {
  const base = validateFacebookVersionDraft(input);
  const blocking = [...base.blocking];
  const selectedIds = uniqueStringIds(input.mediaIds || []);
  const suppliedAssets = Array.isArray(input.mediaAssets) ? input.mediaAssets : null;
  let publishMode = selectedIds.length ? "image" : "text_link";

  if (selectedIds.length && suppliedAssets) {
    const assetsById = new Map(
      suppliedAssets
        .map((asset) => [mediaId(asset), asset])
        .filter(([id]) => Boolean(id)),
    );
    const selectedAssets = selectedIds
      .map((id) => assetsById.get(id))
      .filter(Boolean);

    if (selectedAssets.length !== selectedIds.length) {
      blocking.push("One or more selected media files are no longer available.");
    }

    const videos = selectedAssets.filter((asset) =>
      mediaType(asset).startsWith("video/"),
    );
    const images = selectedAssets.filter((asset) =>
      mediaType(asset).startsWith("image/"),
    );

    if (videos.length) {
      publishMode = "video";

      if (videos.length > 1) {
        blocking.push("Facebook video publishing supports one video per post.");
      }

      if (images.length || videos.length !== selectedAssets.length) {
        blocking.push(
          "Facebook video posts cannot mix a video with image attachments in this publishing flow.",
        );
      }

      for (const asset of videos) {
        const contentType = mediaType(asset);
        const size = Number(asset.size || 0);

        if (!FACEBOOK_VIDEO_CONTENT_TYPES.has(contentType)) {
          blocking.push(
            "Facebook video publishing currently supports MP4, MOV, or M4V files.",
          );
        }

        if (
          !Number.isFinite(size) ||
          size <= 0 ||
          size > FACEBOOK_MAX_VIDEO_BYTES
        ) {
          blocking.push("Facebook video files must be 2 GB or smaller.");
        }
      }

      const thumbnailId = String(input.videoThumbnailMediaId || "").trim();
      if (thumbnailId) {
        const thumbnailAsset = input.videoThumbnailAsset;

        if (!thumbnailAsset || mediaId(thumbnailAsset) !== thumbnailId) {
          blocking.push(
            "The selected Facebook video thumbnail is no longer available.",
          );
        } else {
          validateFacebookImageAsset(thumbnailAsset, blocking, {
            thumbnail: true,
          });
        }
      }
    } else {
      publishMode = selectedIds.length ? "image" : "text_link";

      for (const asset of selectedAssets) {
        validateFacebookImageAsset(asset, blocking);
      }
    }
  }

  return {
    ...base,
    blocking: [...new Set(blocking)],
    publishable: blocking.length === 0,
    publishMode,
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

export function buildFacebookVideoDescription(input = {}) {
  return buildFacebookImagePostMessage(input);
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

export function buildFacebookVideoUrl(pageId, providerVideoId) {
  const normalizedPageId = String(pageId || "").trim();
  const normalizedVideoId = String(providerVideoId || "").trim();

  if (!normalizedPageId || !normalizedVideoId) return "";

  return `https://www.facebook.com/${encodeURIComponent(normalizedPageId)}/videos/${encodeURIComponent(normalizedVideoId)}`;
}

function normalizedStatusValue(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeFacebookVideoProcessingStatus(status = {}) {
  const details =
    status && typeof status.status === "object" && status.status
      ? status.status
      : status || {};
  const allValues = [
    details.video_status,
    details.status,
    details.uploading_phase?.status,
    details.processing_phase?.status,
    details.publishing_phase?.status,
  ]
    .map(normalizedStatusValue)
    .filter(Boolean);

  if (
    allValues.some((value) =>
      ["error", "failed", "failure", "expired"].includes(value),
    )
  ) {
    return "failed";
  }

  const videoStatus = normalizedStatusValue(
    details.video_status || details.status,
  );
  const publishingStatus = normalizedStatusValue(
    details.publishing_phase?.status,
  );

  if (
    ["ready", "published", "complete", "completed"].includes(videoStatus) ||
    ["ready", "published", "complete", "completed"].includes(publishingStatus)
  ) {
    return "succeeded";
  }

  return "processing";
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
