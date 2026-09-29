import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFacebookProviderUrl } from "../lib/facebook-provider-url.js";

test("Facebook provider URLs normalize relative video permalinks", () => {
  assert.equal(
    normalizeFacebookProviderUrl("/GIGnovate/videos/123456"),
    "https://www.facebook.com/GIGnovate/videos/123456",
  );
  assert.equal(
    normalizeFacebookProviderUrl("GIGnovate/videos/123456"),
    "https://www.facebook.com/GIGnovate/videos/123456",
  );
});

test("Facebook provider URLs preserve usable absolute links", () => {
  assert.equal(
    normalizeFacebookProviderUrl("https://www.facebook.com/GIGnovate/videos/123456"),
    "https://www.facebook.com/GIGnovate/videos/123456",
  );
  assert.equal(
    normalizeFacebookProviderUrl("//www.facebook.com/GIGnovate/videos/123456"),
    "https://www.facebook.com/GIGnovate/videos/123456",
  );
  assert.equal(normalizeFacebookProviderUrl(""), "");
});
