import test from "node:test";
import assert from "node:assert/strict";
import {
  parseYouTubeUploadRange, isAllowedYouTubeUploadSession, youtubeVideoUrl,
  nextYouTubeChunkEnd, probeYouTubeResumableUpload, sendYouTubeUploadChunk,
} from "../lib/youtube-uploader.js";
test("YouTube session host and upload ID must be trusted", () => {
  assert.equal(isAllowedYouTubeUploadSession("https://www.googleapis.com/upload/youtube/v3/videos?upload_id=xyz"), true);
  assert.equal(isAllowedYouTubeUploadSession("https://attacker.example/upload/youtube/v3/videos?upload_id=xyz"), false);
  assert.equal(isAllowedYouTubeUploadSession("http://www.googleapis.com/upload/youtube/v3/videos?upload_id=xyz"), false);
});
test("YouTube offset parsing refuses malformed provider ranges", () => {
  assert.equal(parseYouTubeUploadRange(null, 1024), 0);
  assert.equal(parseYouTubeUploadRange("bytes=0-511", 1024), 512);
  assert.throws(() => parseYouTubeUploadRange("bytes=50-511", 1024));
  assert.throws(() => parseYouTubeUploadRange("bytes=0-1024", 1024));
  assert.equal(nextYouTubeChunkEnd(0, 20 * 1024 * 1024), 8 * 1024 * 1024);
  assert.equal(youtubeVideoUrl("abcdefghijk"), "https://www.youtube.com/watch?v=abcdefghijk");
  assert.throws(() => youtubeVideoUrl("bad"));
});
test("YouTube resumable probe uses status request and honors authoritative offset", async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (_url, options) => {
    seen = options;
    return new Response(null, { status: 308, headers: { range: "bytes=0-262143" } });
  };
  try {
    const result = await probeYouTubeResumableUpload({
      sessionUrl: "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc",
      accessToken: "fake-token", size: 1048576,
    });
    assert.equal(seen.headers["Content-Range"], "bytes */1048576");
    assert.equal(result.offset, 262144);
  } finally { globalThis.fetch = original; }
});
test("YouTube chunk upload uses bounded continuous range and refuses arbitrary blocks", async () => {
  const original = globalThis.fetch;
  let seen;
  globalThis.fetch = async (_url, options) => {
    seen = options;
    return new Response(null, { status: 308, headers: { range: "bytes=0-262143" } });
  };
  try {
    const sessionUrl = "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc";
    const result = await sendYouTubeUploadChunk({
      sessionUrl, accessToken: "fake-token", mimeType: "video/mp4",
      size: 524288, offset: 0, bytes: new Uint8Array(262144),
    });
    assert.equal(seen.headers["Content-Range"], "bytes 0-262143/524288");
    assert.equal(result.offset, 262144);
    await assert.rejects(() => sendYouTubeUploadChunk({
      sessionUrl, accessToken: "fake-token", mimeType: "video/mp4",
      size: 524288, offset: 0, bytes: new Uint8Array(1000),
    }));
  } finally { globalThis.fetch = original; }
});
