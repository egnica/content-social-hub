import test from "node:test";
import assert from "node:assert/strict";
import {
  getYouTubeMetadataDefaults, normalizeYouTubeMetadata, parseYouTubeTags,
  validateYouTubeMetadata, buildYouTubeInsertMetadata,
} from "../lib/youtube-metadata-defaults.js";

test("defaults require no repeated declarations but remain independently editable", () => {
  const defaults = getYouTubeMetadataDefaults();
  assert.equal(defaults.paidPromotion, false);
  assert.equal(defaults.containsSyntheticMedia, false);
  assert.equal(defaults.defaultLanguage, "en");
  assert.equal(defaults.captionCertification, "never_aired_us");
  assert.equal(defaults.recordingDate, "");
  assert.equal(defaults.recordingLocation, "");
  assert.deepEqual(defaults.tags, []);
  const channel = getYouTubeMetadataDefaults({ defaultLanguage: "fr", paidPromotion: true });
  assert.equal(channel.defaultLanguage, "fr");
  assert.equal(channel.paidPromotion, true);
  assert.equal(defaults.defaultLanguage, "en");
});

test("edits preserve falsy values and deduplicate tags", () => {
  const changed = normalizeYouTubeMetadata({ paidPromotion: false,
    containsSyntheticMedia: true, tags: "  Video, SEO, video, , Podcast " },
    { paidPromotion: true, defaultLanguage: "fr" });
  assert.equal(changed.paidPromotion, false);
  assert.equal(changed.containsSyntheticMedia, true);
  assert.equal(changed.defaultLanguage, "fr");
  assert.deepEqual(changed.tags, ["Video", "SEO", "Podcast"]);
  assert.deepEqual(parseYouTubeTags(["a", "A", "b"]), ["a", "b"]);
});

test("valid provider metadata goes to video insert payload; app-only fields do not", () => {
  const payload = buildYouTubeInsertMetadata({
    title: "Demo", description: "description", privacyStatus: "private", madeForKids: false,
    defaultLanguage: "en", tags: ["demo", "short"], containsSyntheticMedia: false,
    paidPromotion: false, captionCertification: "never_aired_us",
    recordingLocation: "Minneapolis", recordingDate: "2026-10-13",
  });
  assert.deepEqual(payload.parts, ["snippet", "status", "recordingDetails"]);
  assert.deepEqual(payload.resource.snippet.tags, ["demo", "short"]);
  assert.equal(payload.resource.snippet.defaultLanguage, "en");
  assert.equal(payload.resource.status.containsSyntheticMedia, false);
  assert.equal(payload.resource.recordingDetails.recordingDate, "2026-10-13T00:00:00.000Z");
  assert.equal("paidProductPlacementDetails" in payload.resource, false);
  assert.equal("captionCertification" in payload.resource, false);
  assert.equal("recordingLocation" in payload.resource, false);
});

test("optional recording date is omitted and invalid metadata is blocked", () => {
  const clean = buildYouTubeInsertMetadata({ title: "A", description: "B", privacyStatus: "private", madeForKids: false });
  assert.equal(clean.parts.includes("recordingDetails"), false);
  assert.equal(validateYouTubeMetadata({ recordingDate: "2026-02-30" }).length, 1);
  assert.equal(validateYouTubeMetadata({ containsSyntheticMedia: "no" }).length, 1);
  assert.equal(validateYouTubeMetadata({ tags: ["x".repeat(501)] }).length > 0, true);
  assert.throws(() => buildYouTubeInsertMetadata({ title: "X", paidPromotion: "no" }), TypeError);
});
