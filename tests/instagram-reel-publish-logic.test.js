import assert from "node:assert/strict";
import test from "node:test";
import {
  INSTAGRAM_REEL_MAX_HORIZONTAL_PIXELS,
  INSTAGRAM_REEL_MAX_VIDEO_BYTES,
  INSTAGRAM_REEL_PROVIDER_REQUIREMENTS,
  validateInstagramReelPublishDraft,
} from "../lib/instagram-reel-publish-logic.js";

const reel = {
  _id: "video-1",
  contentType: "video/mp4",
  size: 25_000_000,
  width: 1080,
  height: 1920,
  duration: 30,
};

test("Reel validation accepts a compatible single MP4", () => {
  const result = validateInstagramReelPublishDraft({
    caption: "Reel caption",
    mediaIds: ["video-1"],
    mediaAssets: [reel],
  });

  assert.equal(result.publishable, true);
  assert.equal(result.publishMode, "reel");
  assert.equal(result.selectedAsset._id, "video-1");
});

test("Reel validation accepts MOV/QuickTime container", () => {
  const result = validateInstagramReelPublishDraft({
    mediaIds: ["video-1"],
    mediaAssets: [{ ...reel, contentType: "video/quicktime" }],
  });

  assert.equal(result.publishable, true);
});

test("Reel validation requires exactly one video", () => {
  const result = validateInstagramReelPublishDraft({
    mediaIds: ["video-1", "video-2"],
    mediaAssets: [reel, { ...reel, _id: "video-2" }],
  });

  assert.equal(result.publishable, false);
  assert.match(result.blocking.join(" "), /exactly one video/i);
});

test("Reel validation blocks unsupported container and oversize file", () => {
  const result = validateInstagramReelPublishDraft({
    mediaIds: ["video-1"],
    mediaAssets: [
      {
        ...reel,
        contentType: "video/webm",
        size: INSTAGRAM_REEL_MAX_VIDEO_BYTES + 1,
      },
    ],
  });

  assert.equal(result.publishable, false);
  assert.match(result.blocking.join(" "), /MP4 or MOV/i);
  assert.match(result.blocking.join(" "), /1 GB/i);
});

test("Reel validation enforces 3 second to 15 minute duration", () => {
  const short = validateInstagramReelPublishDraft({
    mediaIds: ["video-1"],
    mediaAssets: [{ ...reel, duration: 2.9 }],
  });
  const long = validateInstagramReelPublishDraft({
    mediaIds: ["video-1"],
    mediaAssets: [{ ...reel, duration: 901 }],
  });

  assert.equal(short.publishable, false);
  assert.equal(long.publishable, false);
  assert.match(short.blocking.join(" "), /3 seconds and 15 minutes/i);
  assert.match(long.blocking.join(" "), /3 seconds and 15 minutes/i);
});

test("Reel validation requires known duration and dimensions", () => {
  const result = validateInstagramReelPublishDraft({
    mediaIds: ["video-1"],
    mediaAssets: [{ ...reel, duration: 0, width: 0, height: 0 }],
  });

  assert.equal(result.publishable, false);
  assert.match(result.blocking.join(" "), /duration metadata/i);
  assert.match(result.blocking.join(" "), /video dimensions/i);
});

test("Reel validation enforces Meta horizontal pixel maximum", () => {
  const result = validateInstagramReelPublishDraft({
    mediaIds: ["video-1"],
    mediaAssets: [
      { ...reel, width: INSTAGRAM_REEL_MAX_HORIZONTAL_PIXELS + 1 },
    ],
  });

  assert.equal(result.publishable, false);
  assert.match(result.blocking.join(" "), /1920 horizontal pixels/i);
});

test("Reel validation blocks unhealthy destinations and overlong captions", () => {
  const result = validateInstagramReelPublishDraft({
    caption: "x".repeat(2201),
    mediaIds: ["video-1"],
    mediaAssets: [reel],
    healthStatus: "expired",
    canPublish: false,
  });

  assert.equal(result.publishable, false);
  assert.match(result.blocking.join(" "), /healthy/i);
  assert.match(result.blocking.join(" "), /2200/);
});

test("Reel validation records provider-enforced codec and bitrate requirements", () => {
  const result = validateInstagramReelPublishDraft({
    mediaIds: ["video-1"],
    mediaAssets: [reel],
  });

  assert.deepEqual(result.providerRequirements.videoCodecs, ["H.264", "HEVC"]);
  assert.equal(result.providerRequirements.audioCodec, "AAC");
  assert.equal(result.providerRequirements.audioSampleRateHz, 48000);
  assert.equal(result.providerRequirements.frameRateMin, 23);
  assert.equal(result.providerRequirements.frameRateMax, 60);
  assert.equal(result.providerRequirements.maxVideoBitrateMbps, 25);
  assert.equal(result.providerRequirements.maxAudioBitrateKbps, 128);
  assert.equal(INSTAGRAM_REEL_PROVIDER_REQUIREMENTS.recommendedAspectRatio, "9:16");
});
