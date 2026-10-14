import assert from "node:assert/strict";
import test from "node:test";
import { fakeCollection } from "./helpers/fake-mongo.js";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import { selectYouTubeUploadThumbnail } from "../lib/youtube-thumbnail-logic.js";

async function setup(contentLength) {
  const version = { _id: "version", platform: "youtube", clientId: "client",
    masterContentId: "master", socialConnectionId: "channel", providerAccountId: "UC-test",
    mediaIds: ["video"], videoThumbnailMediaId: "thumbnail", revision: 1 };
  const attempt = { _id: "attempt", platform: "youtube", platformVersionId: "version",
    submissionKey: "youtube:version:1", status: "processing", providerVideoId: "abcdefghijk" };
  const thumbnail = { _id: "thumbnail", clientId: "client", status: "uploaded",
    contentType: "image/jpeg", objectKey: "private-thumbnail" };
  const attempts = fakeCollection([attempt]);
  // The publisher claims the thumbnail once using MongoDB's $exists guard.
  const update = attempts.updateOne;
  attempts.updateOne = async (filter, fields) => {
    if (filter.thumbnailStartedAt?.$exists === false) {
      if (attempt.thumbnailStartedAt) return { modifiedCount: 0 };
      Object.assign(attempt, fields.$set);
      return { modifiedCount: 1 };
    }
    return update(filter, fields);
  };
  const collections = {
    platform_versions: fakeCollection([version]), publish_attempts: attempts,
    master_content: fakeCollection([{ _id: "master", clientId: "client", contentLength }]),
    social_connections: fakeCollection([{ _id: "channel", clientId: "client", platform: "youtube",
      providerAccountId: "UC-test", healthStatus: "healthy", capabilities: { canPublish: true }, tokenEncrypted: "encrypted" }]),
    media_assets: fakeCollection([{ _id: "video", clientId: "client", status: "uploaded", contentType: "video/mp4" }, thumbnail]),
  };
  let thumbnailWrites = 0, mediaReads = 0, videoCreates = 0;
  const server = await loadWithStubs(new URL("../lib/youtube-publishing.js", import.meta.url), {
    getDb: async () => ({ collection: name => collections[name] }),
    toObjectId: value => value, serializeDocument: value => structuredClone(value),
    refreshSocialConnectionHealth: async () => {}, decryptSecret: () => "fake-token",
    selectYouTubeUploadThumbnail,
    readYouTubeVideoProcessing: async () => ({ uploadStatus: "processed", processingStatus: "succeeded", privacyStatus: "private" }),
    readMediaObject: async () => { mediaReads++; return { bytes: new Uint8Array([1]) }; },
    setYouTubeThumbnail: async () => { thumbnailWrites++; },
    readYouTubeVideoThumbnails: async () => ({ items: [] }),
    summarizeYouTubeThumbnailReadback: () => ({ result: "reported" }),
    youtubeVideoUrl: id => `https://www.youtube.com/watch?v=${id}`,
    startYouTubeResumableUpload: async () => { videoCreates++; throw new Error("Must not create another video"); },
  });
  return { server, version, attempt, thumbnail, counts: () => ({ thumbnailWrites, mediaReads, videoCreates }) };
}

test("a legacy Shorts thumbnail never sends an image while its existing upload completes", async () => {
  const f = await setup("short");
  const result = await f.server.resumeYouTubeVersion("version");
  assert.equal(result.attempt.status, "succeeded");
  assert.equal(result.platformVersion.providerPostId, "abcdefghijk");
  assert.equal(f.version.videoThumbnailMediaId, "thumbnail", "saved media association is preserved");
  assert.deepEqual(f.counts(), { thumbnailWrites: 0, mediaReads: 0, videoCreates: 0 });
});

test("a standard video still submits its custom thumbnail once without reuploading", async () => {
  const f = await setup("long");
  await f.server.resumeYouTubeVersion("version");
  await f.server.resumeYouTubeVersion("version");
  assert.equal(f.attempt.thumbnailStatus, "submitted");
  assert.deepEqual(f.counts(), { thumbnailWrites: 1, mediaReads: 1, videoCreates: 0 });
});
