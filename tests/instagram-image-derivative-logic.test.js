import assert from "node:assert/strict";
import test from "node:test";
import {
  INSTAGRAM_MAX_IMAGE_BYTES,
  createInstagramJpegDerivativeKey,
  instagramJpegDerivativeName,
  isInstagramJpegSourceType,
  needsInstagramJpegDerivative,
} from "../lib/instagram-image-derivative-logic.js";

test("Instagram derivative source types include JPEG, PNG, WebP, and AVIF", () => {
  assert.equal(isInstagramJpegSourceType("image/jpeg"), true);
  assert.equal(isInstagramJpegSourceType("image/png"), true);
  assert.equal(isInstagramJpegSourceType("image/webp"), true);
  assert.equal(isInstagramJpegSourceType("image/avif"), true);
  assert.equal(isInstagramJpegSourceType("image/gif"), false);
});

test("compatible JPEGs reuse the original while convertible images get derivatives", () => {
  assert.equal(
    needsInstagramJpegDerivative({ contentType: "image/jpeg", size: 500_000 }),
    false,
  );
  assert.equal(
    needsInstagramJpegDerivative({ contentType: "image/png", size: 500_000 }),
    true,
  );
  assert.equal(
    needsInstagramJpegDerivative({
      contentType: "image/jpeg",
      size: INSTAGRAM_MAX_IMAGE_BYTES + 1,
    }),
    true,
  );
});

test("Instagram derivative key is deterministic per source media asset", () => {
  assert.equal(
    createInstagramJpegDerivativeKey({ clientId: "client-1", mediaAssetId: "media-1" }),
    "clients/client-1/derivatives/instagram/media-1/jpeg-v1.jpg",
  );
  assert.throws(() => createInstagramJpegDerivativeKey({ clientId: "client-1" }));
});

test("Instagram derivative names preserve a readable source stem", () => {
  assert.equal(instagramJpegDerivativeName("hero.png"), "hero-instagram.jpg");
  assert.equal(instagramJpegDerivativeName("photo.webp"), "photo-instagram.jpg");
});
