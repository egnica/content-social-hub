import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import https from "node:https";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import {
  AUTO_IMAGE_SOURCE, IMAGE_SOURCE_TYPES, MAX_ORIGINAL_IMAGE_BYTES, selectMasterMedia,
} from "../lib/smart-media-logic.js";

const masterUrl = "https://example.test/blog/article";
const imageId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const clientId = "aaaaaaaaaaaaaaaaaaaaaaaa";

async function setup({ status = 200, image = true } = {}) {
  const written = [];
  const inserted = [];
  let metadataRequests = 0;
  let dnsValidations = 0;
  const server = http.createServer((_request, response) => {
    response.writeHead(status, { "content-type": "image/png" });
    response.end(Buffer.from("synthetic png fixture"));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  const loader = await loadWithStubs(
    new URL("../lib/smart-media-import.js", import.meta.url),
    {
      http,
      https,
      sharp: () => ({ metadata: async () => ({
        format: "png", pages: 1, width: 640, height: 480,
      }) }),
      fetchLinkPreviewMetadata: async () => {
        metadataRequests += 1;
        return { imageUrl: image ? `http://photo.example.test:${port}/image.png` : "" };
      },
      resolvePublicHttpUrl: async (url) => {
        dnsValidations += 1;
        // The production resolver rejects private IPs; this fake validated resolver
        // pins a test-only hostname to the loopback HTTP fixture without public traffic.
        return { url, address: "127.0.0.1", family: 4 };
      },
      createObjectKey: () => "clients/" + clientId + "/originals/test-link.png",
      writeMediaObject: async (object) => written.push(object),
      AUTO_IMAGE_SOURCE,
      IMAGE_SOURCE_TYPES,
      MAX_ORIGINAL_IMAGE_BYTES,
      selectMasterMedia,
    },
  );
  const mediaCollection = {
    insertOne: async (document) => {
      inserted.push(document);
      return { insertedId: imageId };
    },
  };
  return {
    ...loader,
    mediaCollection, written, inserted,
    metrics: () => ({ metadataRequests, dnsValidations }),
    close: async () => {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

test("save imports linked image using validated DNS pinning and sets Master default", async () => {
  const fx = await setup();
  try {
    const normalized = { primaryUrl: masterUrl, mediaIds: [], defaultPrimaryMediaId: null };
    const output = await fx.reconcileSmartMasterMedia({
      normalized, validMedia: [], clientId, mediaCollection: fx.mediaCollection,
    });
    assert.equal(output.warning, "");
    assert.deepEqual(normalized.mediaIds, [imageId]);
    assert.equal(normalized.defaultPrimaryMediaId, imageId);
    assert.equal(fx.inserted.length, 1);
    assert.equal(fx.inserted[0].sourceType, "open_graph");
    assert.equal(fx.written.length, 1);
    assert.equal(fx.written[0].contentType, "image/png");
    assert.equal(fx.metrics().dnsValidations, 1);
  } finally { await fx.close(); }
});

test("failed image retrieval saves the post with a visible warning and no photo", async () => {
  const fx = await setup({ status: 503 });
  try {
    const normalized = { primaryUrl: masterUrl, mediaIds: [], defaultPrimaryMediaId: null };
    const output = await fx.reconcileSmartMasterMedia({
      normalized, validMedia: [], clientId, mediaCollection: fx.mediaCollection,
    });
    assert.match(output.warning, /could not be imported/i);
    assert.deepEqual(normalized.mediaIds, []);
    assert.equal(normalized.defaultPrimaryMediaId, null);
    assert.equal(fx.inserted.length, 0);
    assert.equal(fx.written.length, 0);
  } finally { await fx.close(); }
});

test("no usable image metadata returns a warning without creating media", async () => {
  const fx = await setup({ image: false });
  try {
    const normalized = { primaryUrl: masterUrl, mediaIds: [], defaultPrimaryMediaId: null };
    const output = await fx.reconcileSmartMasterMedia({
      normalized, validMedia: [], clientId, mediaCollection: fx.mediaCollection,
    });
    assert.match(output.warning, /did not provide a usable image/);
    assert.deepEqual(normalized.mediaIds, []);
    assert.equal(fx.metrics().dnsValidations, 0);
  } finally { await fx.close(); }
});

test("manually attached media prevents link fetch and stays the default", async () => {
  const fx = await setup();
  try {
    const id = "cccccccccccccccccccccccc";
    const normalized = { primaryUrl: masterUrl, mediaIds: [id], defaultPrimaryMediaId: id };
    const output = await fx.reconcileSmartMasterMedia({
      normalized,
      validMedia: [{ _id: id, contentType: "video/mp4" }],
      clientId, mediaCollection: fx.mediaCollection,
    });
    assert.equal(output.warning, "");
    assert.deepEqual(normalized.mediaIds, [id]);
    assert.equal(normalized.defaultPrimaryMediaId, id);
    assert.equal(fx.metrics().metadataRequests, 0);
  } finally { await fx.close(); }
});

test("matching existing link image is reused on subsequent saves", async () => {
  const fx = await setup();
  try {
    const existing = {
      _id: imageId, sourceType: "open_graph", sourcePageUrl: masterUrl,
    };
    const normalized = {
      primaryUrl: masterUrl, mediaIds: [imageId], defaultPrimaryMediaId: imageId,
    };
    const output = await fx.reconcileSmartMasterMedia({
      normalized, validMedia: [existing],
      clientId, mediaCollection: fx.mediaCollection,
    });
    assert.equal(output.warning, "");
    assert.deepEqual(normalized.mediaIds, [imageId]);
    assert.equal(fx.metrics().metadataRequests, 0);
    assert.equal(fx.inserted.length, 0);
  } finally { await fx.close(); }
});
