import test from "node:test";
import assert from "node:assert/strict";
import {
  safeYouTubeThumbnailUrl,
  youtubeThumbnailStatusLabel,
  summarizeYouTubeThumbnailReadback,
  unavailableYouTubeThumbnailReadback,
} from "../lib/youtube-thumbnail-logic.js";

const videoId = "abcdefghijk", channelId = "UCxxxxxxxxxxxxx";
const payload = { items: [{
  id: videoId,
  snippet: { channelId, thumbnails: {
    high: { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg?cache=123` },
  } },
}] };
test("legacy applied thumbnail only means API acceptance, not visual confirmation", () => {
  assert.equal(youtubeThumbnailStatusLabel({ thumbnailApplied: true, thumbnailStatus: "applied" }),
    "API accepted, visual verification required");
  assert.equal(youtubeThumbnailStatusLabel({ thumbnailApplied: true, thumbnailStatus: "submitted" }),
    "API accepted, visual verification required");
  assert.equal(youtubeThumbnailStatusLabel({ thumbnailStatus: "needs_review" }), "Needs review");
  assert.equal(youtubeThumbnailStatusLabel({ thumbnailStatus: "submitting" }), "Submission started, result uncertain");
  assert.equal(youtubeThumbnailStatusLabel({ videoThumbnailMediaAssetId: "id" }), "Not confirmed");
  assert.equal(youtubeThumbnailStatusLabel({}), "No custom thumbnail selected");
});
test("provider-readback is reported but never labeled as visual verification", () => {
  const result = summarizeYouTubeThumbnailReadback(payload, {
    videoId, channelId, checkedAt: new Date("2026-10-13T22:10:00Z"),
  });
  assert.equal(result.result, "reported");
  assert.equal(result.url, `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`);
  assert.match(result.message, /does not prove/);
  assert.equal(result.checkedAt, "2026-10-13T22:10:00.000Z");
});
test("thumbnail preview URLs are allowlisted, video-specific and stripped of queries", () => {
  assert.equal(safeYouTubeThumbnailUrl(`https://i9.ytimg.com/vi/${videoId}/sddefault.jpg?sig=private`,videoId),
    `https://i9.ytimg.com/vi/${videoId}/sddefault.jpg`);
  assert.equal(safeYouTubeThumbnailUrl(`https://notyoutube.example/vi/${videoId}/hqdefault.jpg`,videoId),null);
  assert.equal(safeYouTubeThumbnailUrl(`http://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,videoId),null);
  assert.equal(safeYouTubeThumbnailUrl("https://i.ytimg.com/vi/other-video/hqdefault.jpg",videoId),null);
  assert.equal(safeYouTubeThumbnailUrl(`https://i.ytimg.com/vi/${videoId}.malicious/hqdefault.jpg`,videoId),null);
});
test("wrong-channel or missing thumbnails cannot be accepted as verified", () => {
  assert.equal(summarizeYouTubeThumbnailReadback(payload, {
    videoId, channelId: "someone-else" }).result, "unavailable");
  assert.equal(summarizeYouTubeThumbnailReadback({ items: [{ id: videoId, snippet: { channelId } }] },
    { videoId, channelId }).result, "not_reported");
  const unavailable = unavailableYouTubeThumbnailReadback();
  assert.equal(unavailable.result, "unavailable");
  assert.equal(unavailable.url, null);
});
