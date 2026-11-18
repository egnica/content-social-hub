import assert from "node:assert/strict";
import test from "node:test";
import { fakeCollection } from "./helpers/fake-mongo.js";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import {
  buildScheduleSuccessFields, classifyScheduledDispatchError, classifyScheduledNoop,
  classifyScheduledPublishResult, evaluateScheduledReleaseDispatch,
  normalizeScheduledReleaseId,
} from "../lib/scheduled-release-dispatch-logic.js";

const id = letter => letter.repeat(24);
const parent = "accounts/123/locations/456";

class GoogleBusinessPublishConflictError extends Error {
  constructor(message, attempt = null) { super(message); this.name = "GoogleBusinessPublishConflictError"; this.attempt = attempt; }
}
class GoogleBusinessPublishProviderError extends Error {
  constructor(message, attempt = null) { super(message); this.name = "GoogleBusinessPublishProviderError"; this.attempt = attempt; }
}
class PublishConflictError extends Error {}
class InstagramPublishConflictError extends Error {}
class LinkedInPublishConflictError extends Error {}
class YouTubePublishConflictError extends Error {}
class PublishProviderError extends Error {}
class InstagramPublishProviderError extends Error {}
class LinkedInPublishProviderError extends Error {}
class YouTubePublishProviderError extends Error {}

async function fixture({ scheduleChange = {}, versionChange = {}, publishStatus = "succeeded",
  throwPublish = null } = {}) {
  const version = {
    _id: id("v"), clientId: id("c"), socialConnectionId: id("s"),
    platform: "google_business_profile", providerAccountId: "locations/456",
    googleBusinessParent: parent, revision: 2, publishedRevision: 0, active: true,
    lastPublishStatus: "", ...versionChange,
  };
  const release = {
    _id: id("b"), platform: "google_business_profile", platformVersionId: version._id,
    clientId: id("c"), socialConnectionId: id("s"),
    providerAccountId: "locations/456", googleBusinessParent: parent,
    platformVersionRevision: 2, state: "scheduled", active: true,
    dispatchedAt: null, retryCount: 0, ...scheduleChange,
  };
  const schedules = fakeCollection([release]), versions = fakeCollection([version]);
  let creates = 0, reads = 0;
  const result = status => ({
    platformVersion: { ...version, lastPublishStatus: status, status: status === "succeeded" ? "published" : "publishing",
      publishedRevision: status === "succeeded" ? 2 : 0 },
    attempt: { _id: id("a"), status, trigger: "scheduled", scheduledReleaseId: release._id,
      providerPostId: `${parent}/localPosts/test-1`,
      providerPostUrl: "https://local.google.com/place?id=456&use=posts&lpsid=abc" },
  });
  const server = await loadWithStubs(new URL("../lib/scheduled-release-dispatch.js", import.meta.url), {
    getDb: async () => ({ collection: name => ({
      scheduled_releases: schedules, platform_versions: versions,
      publish_attempts: fakeCollection([]), media_assets: fakeCollection([]),
    })[name] }),
    toObjectId: value => value, serializeDocument: value => structuredClone(value),
    normalizeScheduledReleaseId, evaluateScheduledReleaseDispatch,
    classifyScheduledNoop, classifyScheduledPublishResult, classifyScheduledDispatchError,
    buildScheduleSuccessFields, GoogleBusinessPublishConflictError,
    GoogleBusinessPublishProviderError, PublishConflictError, InstagramPublishConflictError,
    LinkedInPublishConflictError, YouTubePublishConflictError, PublishProviderError,
    InstagramPublishProviderError, LinkedInPublishProviderError, YouTubePublishProviderError,
    publishGoogleBusinessVersion: async (versionId, revision, options) => {
      creates++;
      assert.equal(versionId, version._id);
      assert.equal(revision, 2);
      assert.equal(options.scheduledReleaseId, release._id);
      if (throwPublish) throw throwPublish;
      version.lastPublishStatus = publishStatus;
      if (publishStatus === "succeeded") version.publishedRevision = 2;
      return result(publishStatus);
    },
    refreshGoogleBusinessPostStatus: async versionId => {
      reads++;
      assert.equal(versionId, version._id);
      version.lastPublishStatus = "succeeded";
      version.publishedRevision = 2;
      return result("succeeded");
    },
  });
  return { server, schedules, version, creates: () => creates, reads: () => reads };
}

test("browser-independent Google scheduled release publishes once and records exact result", async () => {
  const f = await fixture();
  const outcome = await f.server.dispatchScheduledRelease(id("b"));
  assert.equal(outcome.outcome, "succeeded");
  assert.equal(f.creates(), 1);
  assert.equal(f.schedules.documents[0].active, false);
  assert.equal(f.schedules.documents[0].providerPostId, `${parent}/localPosts/test-1`);
  assert.match(f.schedules.documents[0].providerPostUrl, /local.google.com/);
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "noop");
  assert.equal(f.creates(), 1);
});

test("Google cancellation, stale draft and changed client/location never dispatch", async () => {
  const cases = [
    { scheduleChange: { active: false, state: "cancelled" } },
    { versionChange: { revision: 3 } },
    { versionChange: { clientId: "foreign" } },
    { versionChange: { googleBusinessParent: "accounts/999/locations/456" } },
  ];
  for (const opts of cases) {
    const f = await fixture(opts);
    const outcome = await f.server.dispatchScheduledRelease(id("b"));
    assert.ok(["noop", "missed"].includes(outcome.outcome));
    assert.equal(f.creates(), 0);
  }
});

test("Google processing reentry only reads the recorded post; never issues another create", async () => {
  const f = await fixture({ publishStatus: "processing" });
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "processing");
  assert.equal(f.creates(), 1);
  const second = await f.server.dispatchScheduledRelease(id("b"));
  assert.equal(second.outcome, "succeeded");
  assert.equal(f.reads(), 1);
  assert.equal(f.creates(), 1);
  assert.equal((await f.server.dispatchScheduledRelease(id("b"))).outcome, "noop");
});

test("interrupted or ambiguous Google dispatch requires review without repeat publication", async () => {
  const interrupted = await fixture({
    scheduleChange: { state: "dispatching", dispatchedAt: new Date() },
    versionChange: { lastPublishStatus: "submitting" },
  });
  assert.equal((await interrupted.server.dispatchScheduledRelease(id("b"))).outcome, "review_required");
  assert.equal((await interrupted.server.dispatchScheduledRelease(id("b"))).outcome, "noop");
  assert.equal(interrupted.creates(), 0);
  const uncertain = await fixture({
    throwPublish: new GoogleBusinessPublishProviderError("Uncertain", {
      _id: id("a"), status: "unknown", trigger: "scheduled",
      scheduledReleaseId: id("b"),
    }),
  });
  assert.equal((await uncertain.server.dispatchScheduledRelease(id("b"))).outcome, "review_required");
  assert.equal((await uncertain.server.dispatchScheduledRelease(id("b"))).outcome, "noop");
  assert.equal(uncertain.creates(), 1);
});
