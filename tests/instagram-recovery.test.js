import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateInstagramRecovery,
  recoverInstagramAttempt,
} from "../lib/instagram-recovery-logic.js";
import { buildScheduleSuccessFields } from "../lib/scheduled-release-dispatch-logic.js";
import { fakeCollection } from "./helpers/fake-mongo.js";
import { loadWithStubs } from "./helpers/load-with-stubs.js";

const now = new Date("2026-10-02T12:00:00Z");
const old = new Date(+now - 30 * 60_000);
function fixture() {
  return {
    now,
    schedule: {
      _id: "schedule",
      platform: "instagram",
      platformVersionId: "version",
      platformVersionRevision: 3,
      clientId: "client",
      active: true,
      state: "dispatching",
      dispatchedAt: old,
      updatedAt: old,
    },
    version: {
      _id: "version",
      platform: "instagram",
      clientId: "client",
      socialConnectionId: "connection",
      revision: 3,
      mediaIds: ["image"],
      lastPublishAttemptId: "attempt",
      lastPublishStatus: "processing",
      active: true,
    },
    attempt: {
      _id: "attempt",
      platform: "instagram",
      platformVersionId: "version",
      platformVersionRevision: 3,
      clientId: "client",
      socialConnectionId: "connection",
      publishMode: "single_image",
      providerContainerId: "existing-container",
      status: "processing",
      startedAt: old,
    },
  };
}

test("recovery selects only idle matching Instagram attempts with recorded containers", () => {
  assert.equal(evaluateInstagramRecovery(fixture()).action, "resume");
  for (const [field, changes, action] of [
    ["schedule", { state: "scheduled" }, "skip"],
    ["schedule", { platform: "facebook" }, "skip"],
    ["schedule", { active: false }, "skip"],
    ["schedule", { updatedAt: now }, "skip"],
    ["schedule", { publishAttemptId: "another" }, "review"],
    ["version", { revision: 4 }, "review"],
    ["version", { clientId: "another" }, "review"],
    ["version", { active: false }, "review"],
    ["attempt", { socialConnectionId: "another" }, "review"],
    ["attempt", { clientId: "another" }, "review"],
    ["attempt", { platformVersionRevision: 2 }, "review"],
    ["attempt", { providerContainerId: "" }, "review"],
    ["attempt", { status: "submitting" }, "review"],
    ["attempt", { status: "unknown" }, "review"],
    ["attempt", { status: "failed" }, "review"],
    ["attempt", { startedAt: new Date(+now - 86_400_000) }, "review"],
  ]) {
    const value = fixture();
    value[field] = { ...value[field], ...changes };
    assert.equal(
      evaluateInstagramRecovery(value).action,
      action,
      JSON.stringify(changes),
    );
  }
});

test("carousel recovery preserves recorded ordered children; incomplete or reordered children stay locked", () => {
  const f = fixture();
  f.version.mediaIds = ["image", "video"];
  f.attempt.publishMode = "carousel";
  f.attempt.providerContainerId = "";
  f.attempt.providerMedia = [
    { mediaAssetId: "image", providerContainerId: "child1" },
    { mediaAssetId: "video", providerContainerId: "child2" },
  ];
  assert.equal(evaluateInstagramRecovery(f).action, "resume");
  f.attempt.providerMedia.reverse();
  assert.equal(evaluateInstagramRecovery(f).action, "review");
  f.attempt.providerMedia.pop();
  assert.equal(evaluateInstagramRecovery(f).action, "review");
});

test("recovery runner resumes once, reconciles success, and holds uncertain outcomes without a retry callback", async () => {
  for (const status of ["processing", "succeeded", "unknown"]) {
    const f = fixture();
    let checked = 0;
    const result = await recoverInstagramAttempt({
      ...f,
      checkStatus: async () => {
        checked++;
        return {
          platformVersion: f.version,
          attempt: { ...f.attempt, status, providerPostId: "post" },
        };
      },
      succeed: async () => ({ outcome: "succeeded" }),
      processing: async () => ({ outcome: "processing" }),
      review: async () => ({ outcome: "review_required" }),
    });
    assert.equal(checked, 1);
    assert.equal(
      result.outcome,
      status === "unknown" ? "review_required" : status,
    );
  }
  const f = fixture();
  f.attempt.status = "succeeded";
  f.attempt.providerPostId = "post";
  const result = await recoverInstagramAttempt({
    ...f,
    checkStatus: async () =>
      assert.fail("Recorded success needs no new provider call"),
    succeed: async () => ({ outcome: "succeeded" }),
  });
  assert.equal(result.outcome, "succeeded");
});

test("provider read failure keeps the attempt locked and records a failed read", async () => {
  const result = await recoverInstagramAttempt({
    ...fixture(),
    checkStatus: async () => {
      throw new Error("network unavailable");
    },
    processing: async (_result, readFailed) => ({
      outcome: "processing",
      readFailed,
    }),
    review: async () =>
      assert.fail("Read failure cannot prove a failed submission"),
  });
  assert.deepEqual(result, { outcome: "processing", readFailed: true });
});

async function serverSetup(f = fixture()) {
  const schedules = fakeCollection([f.schedule]);
  const versions = fakeCollection([f.version]);
  const attempts = fakeCollection([f.attempt]);
  let checked = 0;
  const check = async () => {
    checked++;
    attempts.documents[0].status = "succeeded";
    attempts.documents[0].providerPostId = "exact-post";
    attempts.documents[0].providerPostUrl =
      "https://www.instagram.com/p/exact-post/";
    return {
      attempt: structuredClone(attempts.documents[0]),
      platformVersion: f.version,
    };
  };
  const serverModule = await loadWithStubs(
    new URL("../lib/scheduled-release-dispatch.js", import.meta.url),
    {
      getDb: async () => ({
        collection: (name) =>
          ({
            scheduled_releases: schedules,
            platform_versions: versions,
            publish_attempts: attempts,
          })[name],
      }),
      serializeDocument: (value) => structuredClone(value),
      toObjectId: (value) => value,
      INSTAGRAM_RECOVERY_IDLE_MS: 20 * 60_000,
      recoverInstagramAttempt,
      buildScheduleSuccessFields,
      checkInstagramPublishStatus: check,
      checkInstagramCarouselPublishStatus: check,
      checkInstagramReelPublishStatus: check,
    },
  );
  return {
    module: serverModule,
    schedules,
    versions,
    attempts,
    checked: () => checked,
  };
}

test("server recovery atomically leases one worker and repairs exact saved success once", async () => {
  const s = await serverSetup();
  const results = await Promise.all([
    s.module.recoverScheduledInstagramRelease("schedule", now),
    s.module.recoverScheduledInstagramRelease("schedule", now),
  ]);
  assert.equal(s.checked(), 1);
  assert.deepEqual(results.map((r) => r.outcome).sort(), ["noop", "succeeded"]);
  assert.equal(s.schedules.documents[0].state, "succeeded");
  assert.equal(s.schedules.documents[0].active, false);
  assert.equal(s.schedules.documents[0].providerPostId, "exact-post");
  assert.equal(s.schedules.documents[0].recoveryLeaseUntil, undefined);
  assert.equal(s.versions.documents[0].publishedRevision, 3);
  assert.equal(s.versions.documents[0].lastPublishAttemptId, "attempt");
  assert.equal(s.attempts.documents.length, 1);
  assert.equal(
    (await s.module.recoverScheduledInstagramRelease("schedule", now)).outcome,
    "noop",
  );
  assert.equal(s.checked(), 1);
});

test("server recovery holds ambiguous submission in review with the destination lock intact", async () => {
  const f = fixture();
  f.attempt.status = "submitting";
  const s = await serverSetup(f);
  const result = await s.module.recoverScheduledInstagramRelease(
    "schedule",
    now,
  );
  assert.equal(result.outcome, "review_required");
  assert.equal(s.checked(), 0);
  assert.equal(s.schedules.documents[0].active, true);
  assert.equal(s.schedules.documents[0].state, "review_required");
  assert.equal(s.versions.documents[0].lastPublishAttemptId, "attempt");
});
