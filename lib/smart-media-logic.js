// Shared media decisions are pure to keep platform and source precedence testable.
export const AUTO_IMAGE_SOURCE = "open_graph";
export const JPEG_VARIANT_VERSION = 1;
export const IMAGE_SOURCE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/avif",
]);
export const MAX_ORIGINAL_IMAGE_BYTES = 25 * 1024 * 1024;

export function supportedImageAsset(asset) {
  if (!asset || !IMAGE_SOURCE_TYPES.has(String(asset.contentType || "").toLowerCase())) return false;
  const size = Number(asset.size);
  return Number.isFinite(size) && size > 0 && size <= MAX_ORIGINAL_IMAGE_BYTES;
}
export function eligibleGooglePhoto(asset) {
  return supportedImageAsset(asset) && Number(asset.width) >= 250 && Number(asset.height) >= 250;
}
export function requiresGooglePhotoDerivative(asset) {
  if (!eligibleGooglePhoto(asset)) return false;
  return !(
    ["image/jpeg", "image/png"].includes(String(asset.contentType).toLowerCase()) &&
    Number(asset.size) >= 10 * 1024 && Number(asset.size) <= 5 * 1024 * 1024
  );
}
export function selectMasterMedia({ media = [], linkUrl = "" } = {}) {
  const manual = media.filter((asset) => asset.sourceType !== AUTO_IMAGE_SOURCE);
  if (manual.length) return { use: "manual", media: manual, importLink: false };
  if (!linkUrl) return { use: "none", media: [], importLink: false };
  const existing = media.find((asset) =>
    asset.sourceType === AUTO_IMAGE_SOURCE && asset.sourcePageUrl === linkUrl
  );
  return existing
    ? { use: "link", media: [existing], importLink: false }
    : { use: "link", media: [], importLink: true };
}
export function jpegVariantKey({ clientId, mediaAssetId }) {
  if (!/^[a-f0-9]{24}$/i.test(String(clientId || "")) ||
      !/^[a-f0-9]{24}$/i.test(String(mediaAssetId || ""))) {
    throw new TypeError("Valid client and media identifiers are required.");
  }
  return "clients/" + clientId + "/derivatives/shared/" + mediaAssetId +
    "/google-jpeg-v" + JPEG_VARIANT_VERSION + ".jpg";
}
