import assert from "node:assert/strict";
import test from "node:test";
import { fakeCollection } from "./helpers/fake-mongo.js";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import { linkedinSubmissionKey, validateLinkedInPublishDraft, linkedinErrorDetails, isLinkedInDefinitiveFailure } from "../lib/linkedin-publish-logic.js";

const id = letter => letter.repeat(24);
async function fixture(mode, { readinessError, createError } = {}) {
  const mediaIds = mode === "multi_image" ? [id("f"), id("g")] : [id("f")];
  const version = { _id: id("a"), clientId: id("c"), masterContentId: id("b"), socialConnectionId: id("d"),
    platform: "linkedin", providerAccountId: "member-1", revision: 1, masterRevisionSynced: 1,
    message: "A genuine future post", mediaIds, active: true };
  const versions = fakeCollection([version]);
  const attempts = fakeCollection();
  attempts.insertOne = async document => {
    if (attempts.documents.some(a => a.submissionKey === document.submissionKey)) throw Object.assign(new Error("duplicate"), { code: 11000 });
    attempts.documents.push({ ...document, _id: id("e") });
    return { insertedId: id("e") };
  };
  const tables = {
    platform_versions: versions, publish_attempts: attempts,
    master_content: fakeCollection([{ _id: id("b"), clientId: id("c"), revision: 1 }]),
    social_connections: fakeCollection([{ _id: id("d"), clientId: id("c"), platform: "linkedin",
      providerAccountId: "member-1", healthStatus: "healthy", capabilities: { canPublish: true }, tokenEncrypted: "mock" }]),
    media_assets: fakeCollection([...mediaIds].reverse().map(assetId => ({ _id: assetId, clientId: id("c"), status: "uploaded",
      contentType: mode === "video" ? "video/mp4" : "image/png", size: 1024, objectKey: assetId }))),
  };
  const events = [];
  const publisher = await loadWithStubs(new URL("../lib/linkedin-publishing.js", import.meta.url), {
    getDb: async () => ({ collection: name => tables[name] }),
    toObjectId: value => value, serializeDocument: value => structuredClone(value),
    refreshSocialConnectionHealth: async () => {}, decryptSecret: () => "mock-token",
    readMediaObject: async key => { events.push(`read:${key}`); return { bytes: Buffer.from(key), contentType: "image/png" }; },
    uploadLinkedInImage: async () => { throw new Error("unexpected legacy upload"); },
    uploadLinkedInRestImage: async ({ bytes }) => { events.push(`image:${bytes.toString()}`); return `urn:li:image:${bytes.toString()}`; },
    uploadLinkedInRestVideo: async () => { events.push("video-upload"); return "urn:li:video:sample-video"; },
    waitForLinkedInVideo: async ({ videoUrn, memberId }) => {
      assert.equal(videoUrn, "urn:li:video:sample-video"); assert.equal(memberId, "member-1");
      events.push("video-readiness"); if (readinessError) throw readinessError;
    },
    createLinkedInPost: async () => { throw new Error("unexpected legacy post"); },
    createLinkedInRestMediaPost: async ({ mediaUrns, mode: actualMode }) => {
      assert.equal(actualMode, mode);
      if (mode === "multi_image") assert.deepEqual(mediaUrns, mediaIds.map(assetId => `urn:li:image:${assetId}`));
      events.push("create-post"); if (createError) throw createError;
      return { providerPostId: "urn:li:share:1234", providerPostUrl: "https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A1234/" };
    },
    linkedinSubmissionKey, validateLinkedInPublishDraft, linkedinErrorDetails, isLinkedInDefinitiveFailure,
  });
  return { publisher, versions, attempts, events };
}

test("multi-image and ready-video publishing each create one post and preserve their revision lock", async () => {
  for (const mode of ["multi_image", "video"]) {
    const f = await fixture(mode);
    const result = await f.publisher.publishLinkedInVersion(id("a"));
    assert.equal(result.attempt.status, "succeeded");
    assert.equal(result.platformVersion.publishedRevision, 1);
    assert.equal(f.events.filter(e => e === "create-post").length, 1);
    if (mode === "video") assert.ok(f.events.indexOf("video-readiness") < f.events.indexOf("create-post"));
    await assert.rejects(f.publisher.publishLinkedInVersion(id("a")), { name: "LinkedInPublishConflictError" });
    assert.equal(f.events.filter(e => e === "create-post").length, 1);
  }
});

test("a video that is not ready fails before public post creation", async () => {
  const f = await fixture("video", { readinessError: Object.assign(new Error("LinkedIn is still processing the video. No post was created."), { name: "LinkedInVideoReadinessError" }) });
  await assert.rejects(f.publisher.publishLinkedInVersion(id("a")), error => {
    assert.equal(error.name, "LinkedInPublishProviderError");
    assert.equal(error.attempt.status, "failed");
    assert.match(error.attempt.providerError.message, /still processing.*No post/);
    return true;
  });
  assert.equal(f.events.includes("create-post"), false);
  assert.equal(f.versions.documents[0].lastPublishStatus, "failed");
});

test("an uncertain media create-post result remains locked without repeating uploads or publication", async () => {
  const f = await fixture("multi_image", { createError: new Error("uncertain provider response") });
  await assert.rejects(f.publisher.publishLinkedInVersion(id("a")), error => {
    assert.equal(error.attempt.status, "unknown"); return true;
  });
  const eventCount = f.events.length;
  await assert.rejects(f.publisher.publishLinkedInVersion(id("a")), { name: "LinkedInPublishConflictError" });
  assert.equal(f.events.length, eventCount);
  assert.equal(f.events.filter(e => e === "create-post").length, 1);
});
