import {
  INSTAGRAM_MAX_IMAGE_BYTES,
  isInstagramJpegSourceType,
  needsInstagramJpegDerivative,
} from "./instagram-image-derivative-logic.js";

export { INSTAGRAM_MAX_IMAGE_BYTES };
export const INSTAGRAM_MIN_IMAGE_ASPECT_RATIO = 4 / 5;
export const INSTAGRAM_MAX_IMAGE_ASPECT_RATIO = 1.91;
export const INSTAGRAM_MAX_CAPTION_LENGTH = 2200;

function mediaId(asset) {
  return String(asset?._id || asset?.id || "").trim();
}

function normalizedAspectRatio(asset) {
  const direct = Number(asset?.aspectRatio);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const width = Number(asset?.width);
  const height = Number(asset?.height);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return width / height;
  }

  return null;
}

export function validateInstagramSingleImagePublishDraft({
  caption = "",
  mediaIds = [],
  mediaAssets = [],
  healthStatus = "healthy",
  canPublish = true,
} = {}) {
  const blocking = [];
  const selectedIds = [...new Set((Array.isArray(mediaIds) ? mediaIds : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean))];

  if (healthStatus !== "healthy" || canPublish !== true) {
    blocking.push("The Instagram destination is not currently healthy and publishable.");
  }

  if (selectedIds.length !== 1) {
    blocking.push(
      selectedIds.length > 1
        ? "Choose one image for a single Instagram post, or use the detected carousel mode."
        : "Choose one compatible image before publishing to Instagram.",
    );
  }

  const assetsById = new Map(
    (Array.isArray(mediaAssets) ? mediaAssets : [])
      .map((asset) => [mediaId(asset), asset])
      .filter(([id]) => Boolean(id)),
  );
  const asset = selectedIds.length === 1 ? assetsById.get(selectedIds[0]) : null;

  if (selectedIds.length === 1 && !asset) {
    blocking.push("The selected Instagram image is no longer available.");
  }

  if (asset) {
    const contentType = String(asset.contentType || "").toLowerCase();
    const ratio = normalizedAspectRatio(asset);

    if (!isInstagramJpegSourceType(contentType)) {
      blocking.push(
        "Instagram image publishing supports JPEG directly and automatically converts PNG, WebP, and AVIF source images to JPEG.",
      );
    }

    if (!ratio) {
      blocking.push("Instagram publishing needs image dimensions to verify the aspect ratio.");
    } else if (
      ratio < INSTAGRAM_MIN_IMAGE_ASPECT_RATIO ||
      ratio > INSTAGRAM_MAX_IMAGE_ASPECT_RATIO
    ) {
      blocking.push("Instagram feed images must use an aspect ratio between 4:5 and 1.91:1.");
    }
  }

  if (String(caption || "").length > INSTAGRAM_MAX_CAPTION_LENGTH) {
    blocking.push(`Instagram captions must be ${INSTAGRAM_MAX_CAPTION_LENGTH} characters or fewer.`);
  }

  return {
    blocking: [...new Set(blocking)],
    publishable: blocking.length === 0,
    publishMode: "single_image",
    selectedAsset: asset || null,
    needsJpegDerivative: asset ? needsInstagramJpegDerivative(asset) : false,
  };
}

export function createInstagramSubmissionKey(platformVersionId, revision) {
  const versionId = String(platformVersionId || "").trim();
  const versionRevision = Number(revision);

  if (!versionId || !Number.isInteger(versionRevision) || versionRevision < 1) {
    throw new TypeError("A saved Instagram version and revision are required.");
  }

  return `instagram:${versionId}:revision:${versionRevision}`;
}

export function normalizeInstagramContainerStatus(value) {
  const status = String(value?.status_code || value?.status || value || "")
    .trim()
    .toUpperCase();

  if (["FINISHED", "PUBLISHED", "READY"].includes(status)) return "finished";
  if (["ERROR", "FAILED", "EXPIRED"].includes(status)) return "failed";
  return "processing";
}

function sanitizeText(value, maxLength = 1000) {
  return String(value || "")
    .replace(/([?&]access_token=)[^&\s]+/gi, "$1[redacted]")
    .replace(/\baccess_token\s*[:=]\s*[^\s,}]+/gi, "access_token=[redacted]")
    .slice(0, maxLength);
}

export function isDefinitiveInstagramProviderFailure(error) {
  const details = error?.details;
  return Boolean(
    error?.name === "InstagramApiError" &&
      details &&
      typeof details === "object" &&
      (details.code !== undefined || details.error_type || details.type || details.message),
  );
}

export function sanitizeInstagramProviderError(error) {
  const details = error?.details || {};

  return {
    name: sanitizeText(error?.name || "InstagramApiError", 120),
    message: sanitizeText(error?.message || "Instagram publishing failed."),
    code: Number.isFinite(Number(details.code)) ? Number(details.code) : null,
    type: sanitizeText(details.error_type || details.type || "", 120),
    errorSubcode: Number.isFinite(Number(details.error_subcode))
      ? Number(details.error_subcode)
      : null,
    isTransient: details.is_transient === true,
    userTitle: sanitizeText(details.error_user_title || "", 240),
    userMessage: sanitizeText(details.error_user_msg || "", 600),
    traceId: sanitizeText(details.fbtrace_id || "", 240),
  };
}

export function normalizeInstagramProviderUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(hostname)) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

export function getInstagramPublishControlState({
  status = "",
  publishedRevision = 0,
  revision = 0,
} = {}) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const currentRevision = Number(revision || 0);
  const successfulRevision = Number(publishedRevision || 0);

  if (
    normalizedStatus === "succeeded" &&
    currentRevision > 0 &&
    successfulRevision === currentRevision
  ) {
    return { mode: "published", canSubmit: false, label: "Published" };
  }

  if (["submitting", "processing"].includes(normalizedStatus)) {
    return { mode: "processing", canSubmit: false, label: "Publishing…" };
  }

  if (normalizedStatus === "unknown") {
    return { mode: "locked", canSubmit: false, label: "Review Required" };
  }

  if (normalizedStatus === "failed") {
    return { mode: "retry", canSubmit: true, label: "Retry Publish" };
  }

  return { mode: "ready", canSubmit: true, label: "Publish Now" };
}

export function isInstagramAttemptForRevision(attempt, revision) {
  if (!attempt) return false;
  return Number(attempt.platformVersionRevision || 0) === Number(revision || 0);
}
