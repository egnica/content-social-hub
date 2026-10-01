export const INSTAGRAM_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const INSTAGRAM_JPEG_DERIVATIVE_VERSION = 1;
export const INSTAGRAM_JPEG_SOURCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export function normalizeInstagramImageContentType(value) {
  return String(value || "").trim().toLowerCase();
}

export function isInstagramJpegSourceType(contentType) {
  return INSTAGRAM_JPEG_SOURCE_TYPES.has(
    normalizeInstagramImageContentType(contentType),
  );
}

export function needsInstagramJpegDerivative(asset = {}) {
  const contentType = normalizeInstagramImageContentType(asset.contentType);
  const size = Number(asset.size || 0);

  if (!isInstagramJpegSourceType(contentType)) return false;
  return (
    contentType !== "image/jpeg" ||
    !Number.isFinite(size) ||
    size <= 0 ||
    size > INSTAGRAM_MAX_IMAGE_BYTES
  );
}

export function createInstagramJpegDerivativeKey({ clientId, mediaAssetId }) {
  const safeClientId = String(clientId || "").trim();
  const safeMediaAssetId = String(mediaAssetId || "").trim();

  if (!safeClientId || !safeMediaAssetId) {
    throw new TypeError(
      "Client and media asset IDs are required for an Instagram derivative.",
    );
  }

  return [
    "clients",
    safeClientId,
    "derivatives",
    "instagram",
    safeMediaAssetId,
    `jpeg-v${INSTAGRAM_JPEG_DERIVATIVE_VERSION}.jpg`,
  ].join("/");
}

export function instagramJpegDerivativeName(originalName = "image") {
  const filename = String(originalName || "image").trim() || "image";
  const stem = filename.replace(/\.[^.]+$/, "") || "image";
  return `${stem}-instagram.jpg`;
}
