export const INSTAGRAM_CAROUSEL_MIN_ITEMS = 2;
export const INSTAGRAM_CAROUSEL_MAX_ITEMS = 10;
export const INSTAGRAM_CAROUSEL_MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
export const INSTAGRAM_CAROUSEL_MIN_VIDEO_DURATION = 3;
export const INSTAGRAM_CAROUSEL_MAX_VIDEO_DURATION = 15 * 60;
export const INSTAGRAM_CAROUSEL_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
]);

import { isInstagramJpegSourceType } from "./instagram-image-derivative-logic.js";
import {
  INSTAGRAM_MAX_CAPTION_LENGTH,
  INSTAGRAM_MIN_IMAGE_ASPECT_RATIO,
  INSTAGRAM_MAX_IMAGE_ASPECT_RATIO,
  validateInstagramSingleImagePublishDraft,
} from "./instagram-publish-logic.js";
import { validateInstagramReelPublishDraft } from "./instagram-reel-publish-logic.js";

function mediaId(asset) {
  return String(asset?._id || asset?.id || "").trim();
}

function normalizedAspectRatio(asset) {
  const direct = Number(asset?.aspectRatio);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const width = Number(asset?.width);
  const height = Number(asset?.height);
  if (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    return width / height;
  }

  return null;
}

function orderedAssets(mediaIds, mediaAssets) {
  const selectedIds = [
    ...new Set(
      (Array.isArray(mediaIds) ? mediaIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ];
  const byId = new Map(
    (Array.isArray(mediaAssets) ? mediaAssets : [])
      .map((asset) => [mediaId(asset), asset])
      .filter(([id]) => Boolean(id)),
  );

  return {
    selectedIds,
    selectedAssets: selectedIds.map((id) => byId.get(id)).filter(Boolean),
  };
}

function validateImage(asset, index, blocking) {
  const contentType = String(asset?.contentType || "").toLowerCase();
  const ratio = normalizedAspectRatio(asset);

  if (!isInstagramJpegSourceType(contentType)) {
    blocking.push(
      `Carousel item ${index + 1} must be JPEG, PNG, WebP, AVIF, or a supported video.`,
    );
    return;
  }

  if (!ratio) {
    blocking.push(
      `Carousel item ${index + 1} needs image dimensions so its aspect ratio can be verified.`,
    );
  } else if (
    ratio < INSTAGRAM_MIN_IMAGE_ASPECT_RATIO ||
    ratio > INSTAGRAM_MAX_IMAGE_ASPECT_RATIO
  ) {
    blocking.push(
      `Carousel item ${index + 1} image must use an aspect ratio between 4:5 and 1.91:1.`,
    );
  }
}

function validateVideo(asset, index, blocking) {
  const contentType = String(asset?.contentType || "").toLowerCase();
  const size = Number(asset?.size || 0);
  const duration = Number(asset?.duration || 0);
  const ratio = normalizedAspectRatio(asset);

  if (!INSTAGRAM_CAROUSEL_VIDEO_TYPES.has(contentType)) {
    blocking.push(
      `Carousel item ${index + 1} video must be MP4 or MOV/QuickTime.`,
    );
  }

  if (
    !Number.isFinite(size) ||
    size <= 0 ||
    size > INSTAGRAM_CAROUSEL_MAX_VIDEO_BYTES
  ) {
    blocking.push(`Carousel item ${index + 1} video must be 1 GB or smaller.`);
  }

  if (
    Number.isFinite(duration) &&
    duration > 0 &&
    (duration < INSTAGRAM_CAROUSEL_MIN_VIDEO_DURATION ||
      duration > INSTAGRAM_CAROUSEL_MAX_VIDEO_DURATION)
  ) {
    blocking.push(
      `Carousel item ${index + 1} video must be between 3 seconds and 15 minutes.`,
    );
  }

  if (
    ratio &&
    (ratio < INSTAGRAM_MIN_IMAGE_ASPECT_RATIO ||
      ratio > INSTAGRAM_MAX_IMAGE_ASPECT_RATIO)
  ) {
    blocking.push(
      `Carousel item ${index + 1} video currently supports aspect ratios between 4:5 and 1.91:1.`,
    );
  }
}

export function validateInstagramCarouselPublishDraft({
  caption = "",
  mediaIds = [],
  mediaAssets = [],
  healthStatus = "healthy",
  canPublish = true,
} = {}) {
  const blocking = [];
  const { selectedIds, selectedAssets } = orderedAssets(mediaIds, mediaAssets);

  if (healthStatus !== "healthy" || canPublish !== true) {
    blocking.push(
      "The Instagram destination is not currently healthy and publishable.",
    );
  }

  if (
    selectedIds.length < INSTAGRAM_CAROUSEL_MIN_ITEMS ||
    selectedIds.length > INSTAGRAM_CAROUSEL_MAX_ITEMS
  ) {
    blocking.push(
      `Instagram carousels require ${INSTAGRAM_CAROUSEL_MIN_ITEMS} to ${INSTAGRAM_CAROUSEL_MAX_ITEMS} ordered media items.`,
    );
  }

  if (selectedAssets.length !== selectedIds.length) {
    blocking.push("One or more selected Instagram carousel items are no longer available.");
  }

  selectedAssets.forEach((asset, index) => {
    const contentType = String(asset?.contentType || "").toLowerCase();

    if (contentType.startsWith("image/")) {
      validateImage(asset, index, blocking);
      return;
    }

    if (contentType.startsWith("video/")) {
      validateVideo(asset, index, blocking);
      return;
    }

    blocking.push(
      `Carousel item ${index + 1} must be a supported Instagram image or video.`,
    );
  });

  if (String(caption || "").length > INSTAGRAM_MAX_CAPTION_LENGTH) {
    blocking.push(
      `Instagram captions must be ${INSTAGRAM_MAX_CAPTION_LENGTH} characters or fewer.`,
    );
  }

  return {
    blocking: [...new Set(blocking)],
    publishable: blocking.length === 0,
    publishMode: "carousel",
    selectedAssets,
  };
}

export function isInstagramCarouselItemVideo(asset) {
  return String(asset?.contentType || "").toLowerCase().startsWith("video/");
}

export function validateInstagramL505PublishDraft(input = {}) {
  const mediaIds = Array.isArray(input.mediaIds) ? input.mediaIds : [];
  const selectedIds = [
    ...new Set(
      mediaIds
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ];

  if (selectedIds.length >= INSTAGRAM_CAROUSEL_MIN_ITEMS) {
    return validateInstagramCarouselPublishDraft(input);
  }

  if (selectedIds.length === 1) {
    const asset = (Array.isArray(input.mediaAssets) ? input.mediaAssets : []).find(
      (item) => mediaId(item) === selectedIds[0],
    );

    if (String(asset?.contentType || "").toLowerCase().startsWith("video/")) {
      return validateInstagramReelPublishDraft(input);
    }
  }

  return validateInstagramSingleImagePublishDraft(input);
}

export const validateInstagramL506PublishDraft = validateInstagramL505PublishDraft;
