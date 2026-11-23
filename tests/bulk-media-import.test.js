import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import https from "node:https";
import { loadWithStubs } from "./helpers/load-with-stubs.js";

async function setup() {
  const writes = [], records = [];
  const server = http.createServer((request, response) => {
    if (request.url === "/redirect") {
      response.writeHead(302, { location: "http://private.example.local/secret" });
      response.end();
    } else if (request.url === "/oversize") {
      response.writeHead(200, { "content-type": "image/jpeg", "content-length": 30 * 1024 * 1024 });
      response.end();
    } else if (request.url === "/image") {
      response.writeHead(200, { "content-type": "image/jpeg" });
      response.end(Buffer.from("synthetic image"));
    } else if (request.url === "/video") {
      response.writeHead(200, { "content-type": "video/mp4" });
      response.end(Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisomfake")]));
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const base = "http://cdn.example.test:" + server.address().port;
  const loader = await loadWithStubs(new URL("../lib/bulk-media-import.js", import.meta.url), {
    http, https,
    sharp: () => ({ metadata: async () => ({ format: "jpeg", width: 640, height: 480, pages: 1 }) }),
    resolvePublicHttpUrl: async (value) => {
      if (value.includes("private.example.local")) throw new TypeError("Private address blocked.");
      return { url: value, address: "127.0.0.1", family: 4 };
    },
    createObjectKey: () => "clients/client-a/originals/bulk-import.jpg",
    writeMediaObject: async (input) => { writes.push(input); },
    createPendingMedia: async (input) => {
      records.push(input);
      return { ...input, _id: "media-a", status: "pending" };
    },
    completeMediaUpload: async () => ({ _id: "media-a", status: "uploaded" }),
  });
  return {
    ...loader, base, writes, records,
    close: async () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test("bulk image fetch is size-bounded and pinned to the validated DNS address", async () => {
  const fixture = await setup();
  try {
    const image = await fixture.downloadBulkMedia(fixture.base + "/image");
    assert.equal(image.contentType, "image/jpeg");
    assert.equal(image.width, 640);
    assert.equal(image.height, 480);
    const saved = await fixture.saveBulkMedia("client-a", image);
    assert.equal(saved.status, "uploaded");
    assert.equal(fixture.writes.length, 1);
    assert.equal(fixture.records.length, 1);
    assert.equal(fixture.records[0].clientId, "client-a");
  } finally { await fixture.close(); }
});

test("remote video is recognized by its header but does not invent technical metadata", async () => {
  const fixture = await setup();
  try {
    const video = await fixture.downloadBulkMedia(fixture.base + "/video");
    assert.equal(video.contentType, "video/mp4");
    assert.equal(video.duration, null);
    assert.equal(video.width, null);
  } finally { await fixture.close(); }
});

test("oversized remote file and redirect to a forbidden address fail without S3 writes", async () => {
  const fixture = await setup();
  try {
    await assert.rejects(fixture.downloadBulkMedia(fixture.base + "/oversize"), /unsupported or exceeds/);
    await assert.rejects(fixture.downloadBulkMedia(fixture.base + "/redirect"), /Private address blocked/);
    assert.equal(fixture.writes.length, 0);
    assert.equal(fixture.records.length, 0);
  } finally { await fixture.close(); }
});
