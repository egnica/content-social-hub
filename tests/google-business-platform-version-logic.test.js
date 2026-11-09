import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInheritedGoogleBusinessFields, googleBusinessImageCompatible,
  isEditableGoogleBusinessConnection, isGoogleBusinessVersionOutOfSync,
  normalizeGoogleBusinessDraft, validateGoogleBusinessDraft,
} from "../lib/google-business-post-logic.js";

const goodImage = { _id: "photo1", contentType: "image/jpeg", size: 100000, width: 720, height: 720 };
const badVideo = { _id: "video1", contentType: "video/mp4", size: 400000, width: 720, height: 720 };
const master = { text: "Our newest update", primaryUrl: "https://example.org/news", mediaIds: ["video1", "photo1"],
  defaultPrimaryMediaId: "video1", revision: 7 };

test("inherits summary, supported link CTA and one compatible master image", () => {
  const draft = buildInheritedGoogleBusinessFields(master, [badVideo, goodImage]);
  assert.equal(draft.summary, "Our newest update");
  assert.equal(draft.ctaType, "LEARN_MORE");
  assert.equal(draft.ctaUrl, "https://example.org/news");
  assert.deepEqual(draft.mediaIds, ["photo1"]);
  assert.equal(draft.masterRevisionSynced, 7);
  assert.equal(draft.releaseSource, "master");
  assert.equal(draft.customized, false);
  assert.equal(isGoogleBusinessVersionOutOfSync(draft, 8), true);
});

test("invalid Master URL never becomes a CTA", () => {
  const draft = buildInheritedGoogleBusinessFields({ ...master, primaryUrl: "javascript:alert(1)" }, [goodImage]);
  assert.equal(draft.ctaType, "");
  assert.equal(draft.ctaUrl, "");
});

test("Google draft access requires exact client, healthy location, not canPublish", () => {
  const connection = { platform: "google_business_profile", clientId: "abc",
    providerAccountId: "accounts/99/locations/77", healthStatus: "healthy",
    capabilities: { canPublish: false } };
  assert.equal(isEditableGoogleBusinessConnection(connection, "abc"), true);
  assert.equal(isEditableGoogleBusinessConnection(connection, "other"), false);
  assert.equal(isEditableGoogleBusinessConnection({ ...connection, healthStatus: "expired" }, "abc"), false);
  assert.equal(isEditableGoogleBusinessConnection({ ...connection, providerAccountId: "accounts/99" }, "abc"), false);
});

test("reject foreign or invalid media, duplicates and video", () => {
  assert.throws(() => normalizeGoogleBusinessDraft({ mediaIds: ["foreign"] }, [goodImage]), /owned/);
  assert.throws(() => normalizeGoogleBusinessDraft({ mediaIds: ["photo1", "photo1"] }, [goodImage]), /one/);
  assert.throws(() => normalizeGoogleBusinessDraft({ mediaIds: ["video1"] }, [badVideo]), /JPG or PNG/);
  assert.equal(googleBusinessImageCompatible({ ...goodImage, width: 249 }), false);
  assert.equal(googleBusinessImageCompatible({ ...goodImage, size: 9 * 1024 }), false);
  assert.equal(googleBusinessImageCompatible({ ...goodImage, size: 6 * 1024 * 1024 }), false);
});

test("Google CTA validation distinguishes optional, link-required, CALL and disallowed GET_OFFER", () => {
  const base = { summary: "Hello", mediaIds: [], ctaType: "", ctaUrl: "" };
  assert.equal(validateGoogleBusinessDraft(base).saveable, true);
  assert.equal(validateGoogleBusinessDraft({ ...base, ctaType: "BOOK" }).saveable, false);
  assert.equal(validateGoogleBusinessDraft({ ...base, ctaType: "BOOK", ctaUrl: "https://example.org" }).saveable, true);
  assert.equal(validateGoogleBusinessDraft({ ...base, ctaType: "CALL" }).saveable, true);
  assert.equal(validateGoogleBusinessDraft({ ...base, ctaType: "CALL", ctaUrl: "https://example.org" }).saveable, false);
  assert.equal(validateGoogleBusinessDraft({ ...base, ctaType: "GET_OFFER" }).saveable, false);
  assert.equal(validateGoogleBusinessDraft({ ...base, ctaType: "SHOP", ctaUrl: "javascript:alert(1)" }).saveable, false);
  assert.equal(validateGoogleBusinessDraft({ ...base, summary: " " }).saveable, false);
  assert.equal(validateGoogleBusinessDraft({ ...base, summary: "x".repeat(1501) }).saveable, false);
  assert.equal(validateGoogleBusinessDraft(base).publishable, false);
});

test("release metadata is draft-only and override values validate", () => {
  const source = { summary: "Hello", mediaIds: [], releaseSource: "destination_override",
    destinationLocalDateTime: "2026-11-20T15:30" };
  const normalized = normalizeGoogleBusinessDraft(source);
  assert.equal(normalized.releaseSource, "destination_override");
  assert.equal(normalized.destinationLocalDateTime, "2026-11-20T15:30");
  assert.equal(validateGoogleBusinessDraft(normalized).saveable, true);
  assert.equal(validateGoogleBusinessDraft({ ...normalized, destinationLocalDateTime: "" }).saveable, false);
  assert.equal(normalizeGoogleBusinessDraft({ ...source, releaseSource: "master" }).destinationLocalDateTime, "");
});
