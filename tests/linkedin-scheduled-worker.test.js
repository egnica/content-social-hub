import assert from "node:assert/strict";
import test from "node:test";
import { validateLinkedInScheduledPublishDraft } from "../lib/linkedin-publish-logic.js";
import { fakeCollection } from "./helpers/fake-mongo.js";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import {
  buildScheduleSuccessFields,
  classifyScheduledDispatchError,
  classifyScheduledNoop,
  classifyScheduledPublishResult,
  evaluateScheduledReleaseDispatch,
  normalizeScheduledReleaseId,
} from "../lib/scheduled-release-dispatch-logic.js";

class LinkedInPublishConflictError extends Error {
  constructor(message, attempt = null) {
    super(message);
    this.name = "LinkedInPublishConflictError";
    this.attempt = attempt;
  }
}
class LinkedInPublishProviderError extends Error {
  constructor(message, attempt = null) {
    super(message);
    this.name = "LinkedInPublishProviderError";
    this.attempt = attempt;
  }
}
class PublishConflictError extends Error {}
class InstagramPublishConflictError extends Error {}
class PublishProviderError extends Error {}
class InstagramPublishProviderError extends Error {}
class YouTubePublishConflictError extends Error {}
class YouTubePublishProviderError extends Error {}

const id = (letter) => letter.repeat(24);

async function fixture({ scheduleChange = {}, versionChange = {}, publish } = {}) {
  const version = {
    _id: id("a"),
    clientId: id("c"),
    socialConnectionId: id("d"),
    providerAccountId: "personal-member",
    platform: "linkedin",
    revision: 2,
    publishedRevision: 0,
    lastPublishStatus: "",
    mediaIds: [],
    active: true,
    ...versionChange,
  };
  const release = {
    _id: id("b"),
    platformVersionId: version._id,
    clientId: id("c"),
    socialConnectionId: id("d"),
    providerAccountId: "personal-member",
    platform: "linkedin",
    platformVersionRevision: 2,
    state: "scheduled",
    active: true,
    dispatchedAt: null,
    retryCount: 0,
    ...scheduleChange,
  };
  const schedules = fakeCollection([release]);
  const versions = fakeCollection([version]);
  const media = fakeCollection();
  let published = 0;
  const server = await loadWithStubs(
    new URL("../lib/scheduled-release-dispatch.js", import.meta.url),
    {
      getDb: async () => ({
        collection: (name) => ({
          scheduled_releases: schedules,
          platform_versions: versions,
          media_assets: media,
          publish_attempts: fakeCollection(),
        })[name],
      }),
      toObjectId: (value) => value,
      serializeDocument: (value) => structuredClone(value),
      normalizeScheduledReleaseId,
      evaluateScheduledReleaseDispatch,
      classifyScheduledNoop,
      classifyScheduledPublishResult,
      classifyScheduledDispatchError,
      buildScheduleSuccessFields,
      publishLinkedInVersion: async (versionId) => {
        published++;
        assert.equal(versionId, version._id);
        return publish
          ? publish(versionId)
          : {
              platformVersion: {
                ...version, status: "published", publishedRevision: 2,
                lastPublishStatus: "succeeded",
              },
              attempt: {
                _id: id("e"), status: "succeeded",
                providerPostId: "urn:li:ugcPost:1234",
                providerPostUrl: "https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A1234/",
              },
            };
      },
      LinkedInPublishConflictError,
      LinkedInPublishProviderError,
      PublishConflictError,
      InstagramPublishConflictError,
      PublishProviderError,
      InstagramPublishProviderError,
      YouTubePublishConflictError,
      YouTubePublishProviderError,
      validateLinkedInScheduledPublishDraft,
    },
  );
  return {
    server, schedules, versions, media,
    calls: () => published,
  };
}

test("LinkedIn worker publishes the recorded revision once with the browser absent", async () => {
  const f = await fixture();
  const result = await f.server.dispatchScheduledRelease(id("b"));
  assert.equal(result.outcome, "succeeded");
  assert.equal(f.calls(), 1);
  assert.equal(f.schedules.documents[0].active, false);
  assert.equal(f.schedules.documents[0].providerPostId, "urn:li:ugcPost:1234");
  assert.match(f.schedules.documents[0].providerPostUrl, /linkedin.com/);
  const reentry = await f.server.dispatchScheduledRelease(id("b"));
  assert.equal(reentry.outcome, "noop");
  assert.equal(f.calls(), 1);
});

test("cancelled LinkedIn release never invokes the provider", async () => {
  const f = await fixture({
    scheduleChange: { state: "cancelled", active: false },
  });
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "noop");
  assert.equal(f.calls(), 0);
});

test("stale LinkedIn revision becomes Missed Schedule without publication", async () => {
  const f = await fixture({ versionChange: { revision: 3 } });
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "missed");
  assert.equal(f.schedules.documents[0].missedReason, "stale_content_revision");
  assert.equal(f.calls(), 0);
});

test("member or client replacement cannot publish the old LinkedIn schedule", async () => {
  const f = await fixture({
    versionChange: { providerAccountId: "different-member" },
  });
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "missed");
  assert.equal(f.calls(), 0);
});

test("LinkedIn expiry or authorization blocker marks missed rather than posting late", async () => {
  const f = await fixture({
    publish: async () => { throw new TypeError("LinkedIn authorization expired. Reconnect."); },
  });
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "missed");
  assert.equal(f.schedules.documents[0].missedReason, "publish_blocked");
});

test("a supported scheduled LinkedIn video dispatches once", async () => {
  const f = await fixture({ versionChange: { mediaIds: [id("f")] } });
  f.media.documents.push({
    _id: id("f"), clientId: id("c"), status: "uploaded",
    contentType: "video/mp4", size: 4096,
  });
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "succeeded");
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "noop");
  assert.equal(f.calls(), 1);
});

test("an uncertain LinkedIn submission stops in review_required without repeat submission", async () => {
  const f = await fixture({
    publish: async () => {
      throw new LinkedInPublishProviderError("Provider result uncertain", {
        _id: id("e"), status: "unknown",
        providerError: { isTransient: true },
      });
    },
  });
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "review_required");
  assert.equal(f.schedules.documents[0].state, "review_required");
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "noop");
  assert.equal(f.calls(), 1);
});


test("scheduled LinkedIn multi-image dispatch uses one public post", async () => {
  const f = await fixture({ versionChange: { mediaIds: [id("f"), id("g")] } });
  for (const letter of ["f", "g"]) f.media.documents.push({
    _id: id(letter), clientId: id("c"), status: "uploaded", contentType: "image/png", size: 1024,
  });
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "succeeded");
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "noop");
  assert.equal(f.calls(), 1);
});

test("scheduled LinkedIn media still rejects foreign, missing, mixed and oversized assets", async () => {
  const cases = [
    [{ _id: id("f"), clientId: id("h"), status: "uploaded", contentType: "video/mp4", size: 4096 }],
    [],
    [{ _id: id("f"), clientId: id("c"), status: "uploaded", contentType: "video/mp4", size: 501 * 1024 * 1024 }],
    [{ _id: id("f"), clientId: id("c"), status: "uploaded", contentType: "video/quicktime", size: 4096 }],
    [{ _id: id("f"), clientId: id("c"), status: "uploaded", contentType: "video/mp4", size: 4096 },
     { _id: id("g"), clientId: id("c"), status: "uploaded", contentType: "image/png", size: 1024 }],
  ];
  for (const assets of cases) {
    const f = await fixture({ versionChange: { mediaIds: assets.length > 1 ? [id("f"), id("g")] : [id("f")] } });
    f.media.documents.push(...assets);
    assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "missed");
    assert.equal(f.calls(), 0);
  }
});
