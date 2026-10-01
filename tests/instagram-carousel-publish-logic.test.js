import assert from "node:assert/strict";
import test from "node:test";
import {
  INSTAGRAM_CAROUSEL_MAX_ITEMS,
  validateInstagramCarouselPublishDraft,
  validateInstagramL505PublishDraft,
} from "../lib/instagram-carousel-publish-logic.js";

const jpeg = {
  _id: "image-1",
  contentType: "image/jpeg",
  size: 500_000,
  width: 1080,
  height: 1350,
};

const video = {
  _id: "video-1",
  contentType: "video/mp4",
  size: 5_000_000,
  width: 1080,
  height: 1350,
  duration: 12,
};

test("carousel validation accepts 2 ordered JPEG items", () => {
  const second = { ...jpeg, _id: "image-2" };
  const result = validateInstagramCarouselPublishDraft({
    caption: "Carousel",
    mediaIds: ["image-2", "image-1"],
    mediaAssets: [jpeg, second],
  });

  assert.equal(result.publishable, true);
  assert.equal(result.publishMode, "carousel");
  assert.deepEqual(result.selectedAssets.map((item) => item._id), ["image-2", "image-1"]);
});

test("carousel validation accepts convertible PNG and WebP children", () => {
  const result = validateInstagramCarouselPublishDraft({
    mediaIds: ["png", "webp"],
    mediaAssets: [
      { ...jpeg, _id: "png", contentType: "image/png" },
      { ...jpeg, _id: "webp", contentType: "image/webp" },
    ],
  });

  assert.equal(result.publishable, true);
});

test("carousel validation accepts mixed image and video children", () => {
  const result = validateInstagramCarouselPublishDraft({
    mediaIds: ["image-1", "video-1"],
    mediaAssets: [jpeg, video],
  });

  assert.equal(result.publishable, true);
});

test("carousel validation enforces the 2 to 10 item boundary", () => {
  const one = validateInstagramCarouselPublishDraft({
    mediaIds: ["image-1"],
    mediaAssets: [jpeg],
  });
  const tooMany = Array.from({ length: INSTAGRAM_CAROUSEL_MAX_ITEMS + 1 }, (_, index) => ({
    ...jpeg,
    _id: `image-${index + 1}`,
  }));
  const eleven = validateInstagramCarouselPublishDraft({
    mediaIds: tooMany.map((item) => item._id),
    mediaAssets: tooMany,
  });

  assert.equal(one.publishable, false);
  assert.match(one.blocking.join(" "), /2 to 10/);
  assert.equal(eleven.publishable, false);
  assert.match(eleven.blocking.join(" "), /2 to 10/);
});

test("carousel validation blocks unsupported image and video children", () => {
  const result = validateInstagramCarouselPublishDraft({
    mediaIds: ["gif", "bad-video"],
    mediaAssets: [
      { ...jpeg, _id: "gif", contentType: "image/gif" },
      { ...video, _id: "bad-video", contentType: "video/webm" },
    ],
  });

  assert.equal(result.publishable, false);
  assert.match(result.blocking.join(" "), /JPEG, PNG, WebP, AVIF/);
  assert.match(result.blocking.join(" "), /MP4 or MOV/);
});

test("carousel validation blocks unhealthy destination and overlong caption", () => {
  const result = validateInstagramCarouselPublishDraft({
    caption: "x".repeat(2201),
    mediaIds: ["image-1", "image-2"],
    mediaAssets: [jpeg, { ...jpeg, _id: "image-2" }],
    healthStatus: "expired",
    canPublish: false,
  });

  assert.equal(result.publishable, false);
  assert.match(result.blocking.join(" "), /healthy/);
  assert.match(result.blocking.join(" "), /2200/);
});

test("L5-05 validation preserves single-image publishing", () => {
  const result = validateInstagramL505PublishDraft({
    mediaIds: ["image-1"],
    mediaAssets: [jpeg],
  });

  assert.equal(result.publishable, true);
  assert.equal(result.publishMode, "single_image");
});

test("L5-05 validation routes 2+ items to carousel", () => {
  const result = validateInstagramL505PublishDraft({
    mediaIds: ["image-1", "video-1"],
    mediaAssets: [jpeg, video],
  });

  assert.equal(result.publishable, true);
  assert.equal(result.publishMode, "carousel");
});

test("L5-05 validation keeps single-video Reels deferred to L5-06", () => {
  const result = validateInstagramL505PublishDraft({
    mediaIds: ["video-1"],
    mediaAssets: [video],
  });

  assert.equal(result.publishable, false);
  assert.equal(result.publishMode, "reel");
  assert.match(result.blocking.join(" "), /L5-06/);
});
