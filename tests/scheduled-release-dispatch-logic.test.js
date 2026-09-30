import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScheduleSuccessFields,
  classifyScheduledPublishResult,
  evaluateScheduledReleaseDispatch,
  normalizeScheduledReleaseId,
} from "../lib/scheduled-release-dispatch-logic.js";

const version = {
  _id: "6abc356c9b523f147ecbf422",
  revision: 6,
  publishedRevision: 0,
  active: true,
};
const schedule = {
  _id: "6abc7081e14044c0e1f6ea65",
  platform: "facebook",
  platformVersionId: version._id,
  platformVersionRevision: 6,
  state: "scheduled",
  active: true,
  dispatchedAt: null,
};

test("normalizes only MongoDB ObjectIds", () => {
  assert.equal(normalizeScheduledReleaseId(schedule._id), schedule._id);
  assert.equal(normalizeScheduledReleaseId("not-an-id"), "");
});

test("ready scheduled revision can be claimed", () => {
  assert.deepEqual(evaluateScheduledReleaseDispatch({ schedule, version }), {
    action: "claim",
    reason: "ready",
  });
});

test("cancelled and superseded schedules are no-ops", () => {
  for (const state of ["cancelled", "superseded"]) {
    assert.equal(
      evaluateScheduledReleaseDispatch({
        schedule: { ...schedule, state, active: false },
        version,
      }).action,
      "noop",
    );
  }
});

test("stale revision is a no-op", () => {
  assert.deepEqual(
    evaluateScheduledReleaseDispatch({
      schedule: { ...schedule, platformVersionRevision: 5 },
      version,
    }),
    { action: "noop", reason: "stale_content_revision" },
  );
});

test("already published scheduled revision is a no-op", () => {
  assert.deepEqual(
    evaluateScheduledReleaseDispatch({
      schedule,
      version: { ...version, publishedRevision: 6 },
    }),
    { action: "noop", reason: "already_published_revision" },
  );
});

test("dispatching video processing refreshes instead of resubmitting", () => {
  assert.deepEqual(
    evaluateScheduledReleaseDispatch({
      schedule: { ...schedule, state: "dispatching", dispatchedAt: new Date() },
      version: { ...version, lastPublishStatus: "processing" },
    }),
    { action: "refresh_processing", reason: "video_processing" },
  );
});

test("publish result classification distinguishes success and processing", () => {
  assert.equal(
    classifyScheduledPublishResult({ attempt: { status: "succeeded" } }),
    "succeeded",
  );
  assert.equal(
    classifyScheduledPublishResult({ attempt: { status: "processing" } }),
    "processing",
  );
});

test("success fields preserve provider result and deactivate schedule", () => {
  const completedAt = new Date("2026-09-30T03:00:00Z");
  assert.deepEqual(
    buildScheduleSuccessFields(
      {
        attempt: {
          _id: "attempt-1",
          providerPostId: "page_post",
          providerPostUrl: "https://facebook.example/post",
        },
      },
      completedAt,
    ),
    {
      state: "succeeded",
      active: false,
      completedAt,
      updatedAt: completedAt,
      publishAttemptId: "attempt-1",
      providerPostId: "page_post",
      providerPostUrl: "https://facebook.example/post",
      failure: null,
    },
  );
});
