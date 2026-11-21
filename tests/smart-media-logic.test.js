import test from "node:test";
import assert from "node:assert/strict";
import {
  eligibleGooglePhoto, requiresGooglePhotoDerivative,
  selectMasterMedia, jpegVariantKey,
} from "../lib/smart-media-logic.js";

const uploaded = { _id: "manual", sourceType: undefined, contentType: "image/png",
  size: 200_000, width: 1200, height: 800 };
const generated = { _id: "automatic", sourceType: "open_graph",
  sourcePageUrl: "https://example.com/post",
  contentType: "image/webp", size: 100_000, width: 1200, height: 800 };

test("manual image or video always wins over inferred link media", () => {
  const selection = selectMasterMedia({ media: [generated, uploaded],
    linkUrl: "https://example.com/post" });
  assert.deepEqual(selection.media, [uploaded]);
  assert.equal(selection.use, "manual");
  assert.equal(selection.importLink, false);
});
test("existing matching inferred image is reused without downloading", () => {
  const selection = selectMasterMedia({ media: [generated],
    linkUrl: "https://example.com/post" });
  assert.deepEqual(selection.media, [generated]);
  assert.equal(selection.importLink, false);
});
test("changed link triggers new import rather than reuse a stale image", () => {
  const selection = selectMasterMedia({ media: [generated],
    linkUrl: "https://example.com/another" });
  assert.deepEqual(selection.media, []);
  assert.equal(selection.importLink, true);
});
test("URL-only content requests an import; empty content does not", () => {
  assert.equal(selectMasterMedia({ media: [], linkUrl: "https://example.com" }).importLink, true);
  assert.equal(selectMasterMedia({ media: [], linkUrl: "" }).importLink, false);
});
test("WebP, AVIF, oversized PNG and JPEG can request Google JPEG conversion", () => {
  for (const type of ["image/webp", "image/avif"]) {
    assert.equal(eligibleGooglePhoto({ ...uploaded, contentType: type }), true);
    assert.equal(requiresGooglePhotoDerivative({ ...uploaded, contentType: type }), true);
  }
  assert.equal(requiresGooglePhotoDerivative({ ...uploaded, size: 7_000_000 }), true);
  assert.equal(requiresGooglePhotoDerivative({ ...uploaded, contentType: "image/jpeg" }), false);
  assert.equal(requiresGooglePhotoDerivative({ ...uploaded, contentType: "image/gif" }), false);
  assert.equal(eligibleGooglePhoto({ ...uploaded, width: 249 }), false);
  assert.equal(eligibleGooglePhoto({ ...uploaded, size: 26 * 1024 * 1024 }), false);
});
test("variant keys are deterministic and client-scoped", () => {
  assert.equal(
    jpegVariantKey({ clientId: "aaaaaaaaaaaaaaaaaaaaaaaa", mediaAssetId: "bbbbbbbbbbbbbbbbbbbbbbbb" }),
    "clients/aaaaaaaaaaaaaaaaaaaaaaaa/derivatives/shared/bbbbbbbbbbbbbbbbbbbbbbbb/google-jpeg-v1.jpg",
  );
  assert.throws(() => jpegVariantKey({ clientId: "../x", mediaAssetId: "x" }), TypeError);
});
