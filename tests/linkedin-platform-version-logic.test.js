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
test("LinkedIn inherits text, link and compatible media", () => {
  assert.deepEqual(buildInheritedLinkedInFields({ text: "Shared", primaryUrl: "https://example.com",
    mediaIds: ["video-1", "image-1"], media: [video, image], revision: 3 }),
    { message: "Shared", destinationUrl: "https://example.com", mediaIds: ["video-1"],
      primaryMediaId: "video-1", masterRevisionSynced: 3, customized: false });
});
test("LinkedIn rejects unsupported and foreign media", () => {
  assert.deepEqual(normalizeLinkedInVersionDraft({ message: "Hi", mediaIds: ["image-1"] }, [image]),
    { message: "Hi", destinationUrl: "", mediaIds: ["image-1"], primaryMediaId: "image-1" });
  assert.equal(normalizeLinkedInVersionDraft({ mediaIds: ["video-1"] }, [image, video]).primaryMediaId, "video-1");
  assert.throws(() => normalizeLinkedInVersionDraft({ mediaIds: ["video-1","image-1"] }, [image, video]), /Choose 1/);
  assert.throws(() => normalizeLinkedInVersionDraft({ mediaIds: ["foreign"] }, [image]), /Choose 1/);
});
test("LinkedIn validation blocks invalid URL, unsupported media and unhealthy account", () => {
  const v = validateLinkedInVersionDraft({ destinationUrl: "not-a-url",
    mediaIds: ["video-1"], media: [video], healthStatus: "expired", canPublish: false });
  assert.equal(v.publishable, false);
  assert.equal(v.blocking.length, 2);
});
test("LinkedIn preserves customized text through Master revision change", () => {
  assert.equal(isLinkedInVersionOutOfSync({ masterRevisionSynced: 2 }, 3), true);
  const v = validateLinkedInVersionDraft({ message: "Custom post", customized: true, masterChanged: true });
  assert.equal(v.publishable, true);
  assert.match(v.warnings[0], /preserved/);
});
test("LinkedIn accepts 2–20 images but no mixed video or unsupported files", () => {
  const images=Array.from({length:20},(_,i)=>({_id:"i"+i,contentType:"image/png"}));
  const ids=images.map(a=>a._id);
  assert.equal(normalizeLinkedInVersionDraft({mediaIds:ids},images).mediaIds.length,20);
  assert.throws(()=>normalizeLinkedInVersionDraft({mediaIds:[...ids,"overflow"]},
    [...images,{_id:"overflow",contentType:"image/png"}]), /Choose 1/);
  assert.throws(()=>normalizeLinkedInVersionDraft({mediaIds:["video-1","i0"]},
    [video,...images]), /Choose 1/);
});
