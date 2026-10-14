import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInheritedYouTubeFields, isYouTubeVersionOutOfSync,
  isPublishableSocialConnection, normalizeYouTubeVersionDraft,
  validateYouTubeVersionDraft, prepareYouTubeChapters, prepareYouTubeDescription,
} from "../lib/platform-version-logic.js";

const video = { _id: "video-1", contentType: "video/mp4" };
const image = { _id: "image-1", contentType: "image/jpeg" };
const ready = {
  title: "A video", description: "Description", privacyStatus: "private",
  madeForKids: false, mediaIds: ["video-1"], media: [video],
};
test("YouTube eligibility enforces client ownership, health and publish scope", () => {
  const c = { clientId: "one", platform: "youtube", providerAccountId: "UC123", healthStatus: "healthy", capabilities: { canPublish: true } };
  assert.equal(isPublishableSocialConnection(c, "one"), true);
  assert.equal(isPublishableSocialConnection(c, "two"), false);
  assert.equal(isPublishableSocialConnection({ ...c, healthStatus: "expired" }, "one"), false);
});
test("YouTube inherits one Master video and private default but no audience declaration", () => {
  const result = buildInheritedYouTubeFields({
    internalTitle: "Master title", text: "Master description",
    mediaIds: ["image-1", "video-1"], media: [image, video],
    defaultVideoThumbnailMediaId: "thumb-1", revision: 4,
  });
  assert.equal(result.primaryMediaId, "video-1");
  assert.deepEqual(result.mediaIds, ["video-1"]);
  assert.equal(result.madeForKids, null);
  assert.equal(result.privacyStatus, "private");
  assert.equal(result.masterRevisionSynced, 4);
});
test("YouTube version normalization preserves independent metadata", () => {
  assert.deepEqual(normalizeYouTubeVersionDraft({ ...ready, chapters: "00:00 Intro", videoThumbnailMediaId: "image-1" }),
    { title: "A video", description: "Description", privacyStatus: "private", madeForKids: false,
      mediaIds: ["video-1"], primaryMediaId: "video-1", videoThumbnailMediaId: "image-1", chapters: "00:00 Intro", playlistIds: [],
      paidPromotion: false, containsSyntheticMedia: false, defaultLanguage: "en",
      captionCertification: "never_aired_us", tags: [], recordingDate: "", recordingLocation: "" });
});
test("YouTube validates visibility, audience, title and UTF-8 description limits", () => {
  assert.equal(validateYouTubeVersionDraft(ready).publishable, true);
  assert.equal(validateYouTubeVersionDraft({ ...ready, title: "x".repeat(101) }).publishable, false);
  assert.equal(validateYouTubeVersionDraft({ ...ready, description: "😀".repeat(1251) }).publishable, false);
  assert.equal(validateYouTubeVersionDraft({ ...ready, privacyStatus: "friends" }).publishable, false);
  assert.equal(validateYouTubeVersionDraft({ ...ready, madeForKids: null }).publishable, false);
});
test("YouTube rejects image-only, mixed and unattached foreign video", () => {
  for (const ids of [["image-1"], ["video-1", "image-1"], ["foreign"]])
    assert.equal(validateYouTubeVersionDraft({ ...ready, mediaIds: ids, media: [video, image] }).publishable, false);
});
test("YouTube chapters require 00:00 and three ordered ten-second sections", () => {
  assert.equal(validateYouTubeVersionDraft({ ...ready, chapters: "00:00 Intro\n00:15 Topic\n01:00 End" }).publishable, true);
  assert.equal(validateYouTubeVersionDraft({ ...ready, chapters: "00:00 Intro\n00:05 Topic\n01:00 End" }).publishable, false);
  assert.equal(validateYouTubeVersionDraft({ ...ready, chapters: "00:12 Intro\n00:30 Topic\n01:00 End" }).publishable, false);
});
test("YouTube thumbnails require matching JPEG or PNG and preserve custom edits", () => {
  assert.equal(validateYouTubeVersionDraft({ ...ready, thumbnail: image, videoThumbnailMediaId: "image-1" }).publishable, true);
  assert.equal(validateYouTubeVersionDraft({ ...ready, videoThumbnailMediaId: "foreign" }).publishable, false);
  assert.equal(isYouTubeVersionOutOfSync({ masterRevisionSynced: 2 }, 3), true);
  const result = validateYouTubeVersionDraft({ ...ready, customized: true, masterChanged: true });
  assert.match(result.warnings[0], /preserved/);
});

test("YouTube prepares chapters once with accurate duration and description byte accounting", () => {
  const chapters = "00:00 Intro\n00:15 Topic\n01:00 Wrap-up";
  assert.equal(prepareYouTubeChapters(chapters).errors.length, 0);
  const prepared = prepareYouTubeDescription("About the video", chapters);
  assert.equal(prepared.text, "About the video\n\n" + chapters);
  assert.deepEqual(prepared.chapterSeconds, [0, 15, 60]);
  assert.equal(validateYouTubeVersionDraft({ ...ready, chapters, videoDuration: 75 }).publishable, true);
  assert.equal(validateYouTubeVersionDraft({ ...ready, chapters, videoDuration: 65 }).publishable, false);
  assert.equal(prepareYouTubeDescription("😀".repeat(1248), chapters).errors.length > 0, true);
  assert.equal(prepareYouTubeDescription("Text", "00:00 Intro\n00:05 Too soon\n00:10 End").errors.length > 0, true);
});
test("YouTube thumbnail preflight enforces API size limit and advises format-specific dimensions", () => {
  const thumbnail = { ...image, size: 51 * 1024 * 1024, width: 1080, height: 1920 };
  const selected = { ...ready, videoThumbnailMediaId: "image-1", thumbnail };
  assert.equal(validateYouTubeVersionDraft({ ...selected, isShort: true }).publishable, false);
  const allowed = validateYouTubeVersionDraft({ ...selected,
    thumbnail: { ...thumbnail, size: 2 * 1024 * 1024 }, isShort: true });
  assert.equal(allowed.publishable, true);
  assert.equal(allowed.warnings.some((warning) => warning.includes("9:16")), false);
  const standard = validateYouTubeVersionDraft({ ...selected,
    thumbnail: { ...thumbnail, size: 2 * 1024 * 1024 }, isShort: false });
  assert.equal(standard.warnings.some((warning) => warning.includes("16:9")), true);
});
