import { INSTAGRAM_MAX_CAPTION_LENGTH } from "./instagram-publish-logic.js";

export const INSTAGRAM_REEL_MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
export const INSTAGRAM_REEL_MIN_DURATION = 3;
export const INSTAGRAM_REEL_MAX_DURATION = 15 * 60;
export const INSTAGRAM_REEL_MAX_HORIZONTAL_PIXELS = 1920;
export const INSTAGRAM_REEL_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
]);

export const INSTAGRAM_REEL_PROVIDER_REQUIREMENTS = Object.freeze({
  videoCodecs: ["H.264", "HEVC"],
  audioCodec: "AAC",
  audioSampleRateHz: 48000,
  frameRateMin: 23,
  frameRateMax: 60,
  maxVideoBitrateMbps: 25,
  maxAudioBitrateKbps: 128,
  recommendedAspectRatio: "9:16",
});

function mediaId(asset) {
  return String(asset?._id || asset?.id || "").trim();
}

export function resolveInstagramReelCoverMediaId({
  versionCoverMediaId = "",
  masterCoverMediaId = "",
  versionMasterRevision = 0,
  masterRevision = 0,
} = {}) {
  const savedCover = String(versionCoverMediaId || "").trim();
  if (savedCover) return savedCover;

  const syncedRevision = Number(versionMasterRevision || 0);
  const currentRevision = Number(masterRevision || 0);

  if (syncedRevision > 0 && syncedRevision === currentRevision) {
    return String(masterCoverMediaId || "").trim();
  }

  return "";
}

export function validateInstagramReelPublishDraft({
  caption = "",
  mediaIds = [],
  mediaAssets = [],
  healthStatus = "healthy",
  canPublish = true,
} = {}) {
  const blocking = [];
  const selectedIds = [
    ...new Set(
      (Array.isArray(mediaIds) ? mediaIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ];

  if (healthStatus !== "healthy" || canPublish !== true) {
    blocking.push(
      "The Instagram destination is not currently healthy and publishable.",
    );
  }

  if (selectedIds.length !== 1) {
    blocking.push("Instagram Reel publishing requires exactly one video.");
  }

  const assetsById = new Map(
    (Array.isArray(mediaAssets) ? mediaAssets : [])
      .map((asset) => [mediaId(asset), asset])
      .filter(([id]) => Boolean(id)),
  );
  const asset = selectedIds.length === 1 ? assetsById.get(selectedIds[0]) : null;

  if (selectedIds.length === 1 && !asset) {
    blocking.push("The selected Instagram Reel video is no longer available.");
  }

  if (asset) {
    const contentType = String(asset.contentType || "").toLowerCase();
    const size = Number(asset.size || 0);
    const duration = Number(asset.duration || 0);
    const width = Number(asset.width || 0);

    if (!INSTAGRAM_REEL_VIDEO_TYPES.has(contentType)) {
      blocking.push("Instagram Reels require an MP4 or MOV/QuickTime video.");
    }

    if (
      !Number.isFinite(size) ||
      size <= 0 ||
      size > INSTAGRAM_REEL_MAX_VIDEO_BYTES
    ) {
      blocking.push("Instagram Reel videos must be 1 GB or smaller.");
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      blocking.push(
        "Instagram Reel publishing needs video duration metadata before submission.",
      );
    } else if (
      duration < INSTAGRAM_REEL_MIN_DURATION ||
      duration > INSTAGRAM_REEL_MAX_DURATION
    ) {
      blocking.push("Instagram Reel videos must be between 3 seconds and 15 minutes.");
    }

    if (!Number.isFinite(width) || width <= 0) {
      blocking.push(
        "Instagram Reel publishing needs video dimensions before submission.",
      );
    } else if (width > INSTAGRAM_REEL_MAX_HORIZONTAL_PIXELS) {
      blocking.push("Instagram Reel videos may be at most 1920 horizontal pixels.");
    }
  }

  if (String(caption || "").length > INSTAGRAM_MAX_CAPTION_LENGTH) {
    blocking.push(
      `Instagram captions must be ${INSTAGRAM_MAX_CAPTION_LENGTH} characters or fewer.`,
    );
  }

  return {
    blocking: [...new Set(blocking)],
    publishable: blocking.length === 0,
    publishMode: "reel",
    selectedAsset: asset || null,
    providerRequirements: INSTAGRAM_REEL_PROVIDER_REQUIREMENTS,
  };
}
