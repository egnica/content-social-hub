import test from "node:test";
import assert from "node:assert/strict";
import {
  parseYouTubeUploadRange, isAllowedYouTubeUploadSession, youtubeVideoUrl,
  nextYouTubeChunkEnd, probeYouTubeResumableUpload, sendYouTubeUploadChunk, readYouTubeVideoThumbnails,
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
    assert.equal(seen.method, "PUT");
    assert.equal(seen.redirect, "manual");
    assert.equal(seen.body, undefined);
    assert.equal(seen.headers["Content-Length"], "0");
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
    assert.equal(seen.redirect, "manual");
    assert.equal(seen.headers["Content-Range"], "bytes 0-262143/524288");
    assert.equal(result.offset, 262144);
    await assert.rejects(() => sendYouTubeUploadChunk({
      sessionUrl, accessToken: "fake-token", mimeType: "video/mp4",
      size: 524288, offset: 0, bytes: new Uint8Array(1000),
    }));
  } finally { globalThis.fetch = original; }
});

test("zero-byte status probe never starts another video and keeps expired session recoverable", async () => {
  const original = globalThis.fetch;
  const calls = [];
  const sessionUrl = "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc";
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method, redirect: options.redirect, body: options.body, headers: options.headers });
    return new Response(null, { status: 404 });
  };
  try {
    await assert.rejects(() => probeYouTubeResumableUpload({
      sessionUrl, accessToken: "fake-token", size: 500000,
    }), error => error.status === 404);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "PUT");
    assert.equal(calls[0].redirect, "manual");
    assert.equal(calls[0].url, sessionUrl);
    assert.equal(calls[0].body, undefined);
    assert.equal(calls[0].headers["Content-Length"], "0");
  } finally { globalThis.fetch = original; }
});

test("YouTube upload does not follow a redirect from the resumable session endpoint", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls += 1;
    assert.equal(options.redirect, "manual");
    return new Response(null, {
      status: 308,
      headers: { location: "https://not-youtube.example/redirect", range: "bytes=0-262143" },
    });
  };
  try {
    const result = await probeYouTubeResumableUpload({
      sessionUrl: "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc",
      accessToken: "fake-token", size: 1048576,
    });
    assert.equal(result.offset, 262144);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("YouTube thumbnail readback uses read-only videos.list without any upload request", async () => {
  const original = globalThis.fetch;
  const requests = [];
  const id = "abcdefghijk";
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ items: [{
      id, snippet: { channelId: "UC-test", thumbnails: {
        high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
      } },
    }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await readYouTubeVideoThumbnails({ accessToken: "fake", videoId: id });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].options.method, "GET");
    assert.equal(requests[0].options.body, undefined);
    assert.match(requests[0].url, /part=snippet/);
    assert.equal(result.items[0].snippet.channelId, "UC-test");
    assert.equal(result.items[0].snippet.thumbnails.high.url,
      `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  } finally { globalThis.fetch = original; }
});
