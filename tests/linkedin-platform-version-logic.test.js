import assert from "node:assert/strict";
import test from "node:test";
import { buildInheritedLinkedInFields, isLinkedInVersionOutOfSync,
  isPublishableLinkedInConnection, normalizeLinkedInVersionDraft,
  validateLinkedInVersionDraft } from "../lib/platform-version-logic.js";

const image = { _id: "image-1", contentType: "image/jpeg" };
const video = { _id: "video-1", contentType: "video/mp4" };

test("LinkedIn eligibility respects client and connection health", () => {
  const c = { clientId: "a", platform: "linkedin", providerAccountId: "member-1",
    healthStatus: "healthy", capabilities: { canPublish: true } };
  assert.equal(isPublishableLinkedInConnection(c, "a"), true);
  assert.equal(isPublishableLinkedInConnection(c, "b"), false);
  assert.equal(isPublishableLinkedInConnection({ ...c, healthStatus: "expired" }, "a"), false);
  assert.equal(isPublishableLinkedInConnection({ ...c, platform: "facebook" }, "a"), false);
});
test("LinkedIn inherits text, link and first compatible image", () => {
  assert.deepEqual(buildInheritedLinkedInFields({ text: "Shared", primaryUrl: "https://example.com",
    mediaIds: ["video-1", "image-1"], media: [video, image], revision: 3 }),
    { message: "Shared", destinationUrl: "https://example.com", mediaIds: ["image-1"],
      primaryMediaId: "image-1", masterRevisionSynced: 3, customized: false });
});
test("LinkedIn rejects unsupported and foreign media", () => {
  assert.deepEqual(normalizeLinkedInVersionDraft({ message: "Hi", mediaIds: ["image-1"] }, [image]),
    { message: "Hi", destinationUrl: "", mediaIds: ["image-1"], primaryMediaId: "image-1" });
  assert.throws(() => normalizeLinkedInVersionDraft({ mediaIds: ["video-1"] }, [image, video]), /at most one/);
  assert.throws(() => normalizeLinkedInVersionDraft({ mediaIds: ["foreign"] }, [image]), /at most one/);
});
test("LinkedIn validation blocks invalid URL, unsupported media and unhealthy account", () => {
  const v = validateLinkedInVersionDraft({ destinationUrl: "not-a-url",
    mediaIds: ["video-1"], media: [video], healthStatus: "expired", canPublish: false });
  assert.equal(v.publishable, false);
  assert.equal(v.blocking.length, 3);
});
test("LinkedIn preserves customized text through Master revision change", () => {
  assert.equal(isLinkedInVersionOutOfSync({ masterRevisionSynced: 2 }, 3), true);
  const v = validateLinkedInVersionDraft({ message: "Custom post", customized: true, masterChanged: true });
  assert.equal(v.publishable, true);
  assert.match(v.warnings[0], /preserved/);
});