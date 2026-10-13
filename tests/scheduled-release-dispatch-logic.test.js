import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_SCHEDULED_RELEASE_AUTOMATIC_RETRIES,
  buildScheduleSuccessFields,
  classifyScheduledDispatchError,
  classifyScheduledNoop,
  classifyScheduledPublishResult,
  evaluateScheduledReleaseDispatch,
  normalizeScheduledReleaseId,
} from "../lib/scheduled-release-dispatch-logic.js";
import { evaluateScheduleState } from "../lib/scheduling-logic.js";

const version = {
  _id: "6abc356c9b523f147ecbf422",
  platform: "facebook",
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
  retryCount: 0,
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

test("ready Instagram scheduled revision can be claimed", () => {
  const instagramVersion = { ...version, platform: "instagram" };
  const instagramSchedule = { ...schedule, platform: "instagram" };

  assert.deepEqual(
    evaluateScheduledReleaseDispatch({
      schedule: instagramSchedule,
      version: instagramVersion,
    }),
    {
      action: "claim",
      reason: "ready",
    },
  );
});

test("schedule and destination platform mismatch is blocked", () => {
  assert.deepEqual(
    evaluateScheduledReleaseDispatch({
      schedule: { ...schedule, platform: "instagram" },
      version: { ...version, platform: "facebook" },
    }),
    { action: "noop", reason: "destination_mismatch" },
  );
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

test("stale revision remains a provider no-op decision", () => {
  assert.deepEqual(
    evaluateScheduledReleaseDispatch({
      schedule: { ...schedule, platformVersionRevision: 5 },
      version,
    }),
    { action: "noop", reason: "stale_content_revision" },
  );
});

test("stale and unavailable release blockers become missed schedule dispositions", () => {
  for (const reason of [
    "stale_content_revision",
    "destination_unavailable",
    "destination_mismatch",
  ]) {
    assert.deepEqual(classifyScheduledNoop(reason), {
      outcome: "missed",
      state: "missed",
      reason,
    });
  }
  assert.equal(classifyScheduledNoop("cancelled").outcome, "noop");
});

test("already published scheduled revision is a no-op before missed classification", () => {
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
    { action: "refresh_processing", reason: "provider_processing" },
  );
});

test("review-required schedule remains locked against worker re-entry", () => {
  assert.deepEqual(
    evaluateScheduledReleaseDispatch({
      schedule: { ...schedule, state: "review_required", active: true },
      version,
    }),
    { action: "noop", reason: "review_required" },
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

test("human or validation blockers become missed schedules", () => {
  assert.deepEqual(
    classifyScheduledDispatchError(
      { name: "TypeError", message: "Facebook account is unhealthy." },
      schedule,
    ),
    {
      outcome: "missed",
      state: "missed",
      reason: "publish_blocked",
      retryable: false,
    },
  );
});

test("definitive transient provider failure is automatically retryable within the bound", () => {
  const result = classifyScheduledDispatchError(
    {
      name: "PublishProviderError",
      attempt: {
        status: "failed",
        providerError: { isTransient: true },
      },
    },
    schedule,
  );

  assert.equal(result.outcome, "retry");
  assert.equal(result.retryable, true);
  assert.ok(result.retryDelayMs > 0);
});

test("Instagram definitive transient provider failure uses the same bounded retry policy", () => {
  const result = classifyScheduledDispatchError(
    {
      name: "InstagramPublishProviderError",
      attempt: {
        status: "failed",
        providerError: { isTransient: true },
      },
    },
    { ...schedule, platform: "instagram" },
  );

  assert.equal(result.outcome, "retry");
  assert.equal(result.retryable, true);
  assert.ok(result.retryDelayMs > 0);
});

test("Instagram ambiguous conflict remains locked for review", () => {
  assert.deepEqual(
    classifyScheduledDispatchError(
      {
        name: "InstagramPublishConflictError",
        attempt: {
          status: "processing",
        },
      },
      { ...schedule, platform: "instagram" },
    ),
    {
      outcome: "review_required",
      state: "review_required",
      reason: "ambiguous_provider_outcome",
      retryable: false,
    },
  );
});

test("automatic retries stop after the configured maximum", () => {
  const result = classifyScheduledDispatchError(
    {
      name: "PublishProviderError",
      attempt: {
        status: "failed",
        providerError: { isTransient: true },
      },
    },
    { ...schedule, retryCount: MAX_SCHEDULED_RELEASE_AUTOMATIC_RETRIES },
  );

  assert.deepEqual(result, {
    outcome: "failed",
    state: "failed",
    reason: "automatic_retry_exhausted",
    retryable: false,
  });
});

test("definitive non-transient provider failure remains visible and manually retryable", () => {
  assert.deepEqual(
    classifyScheduledDispatchError(
      {
        name: "PublishProviderError",
        attempt: {
          status: "failed",
          providerError: { isTransient: false },
        },
      },
      schedule,
    ),
    {
      outcome: "failed",
      state: "failed",
      reason: "definitive_provider_failure",
      retryable: false,
    },
  );
});

test("ambiguous provider outcome is locked for review instead of retried", () => {
  assert.deepEqual(
    classifyScheduledDispatchError(
      {
        name: "PublishProviderError",
        attempt: {
          status: "unknown",
          providerError: { isTransient: true },
        },
      },
      schedule,
    ),
    {
      outcome: "review_required",
      state: "review_required",
      reason: "ambiguous_provider_outcome",
      retryable: false,
    },
  );
});

test("schedule state exposes missed, failed, review and succeeded outcomes before past-time fallback", () => {
  const base = {
    releaseAt: "2026-09-30T03:00:00Z",
    now: new Date("2026-09-30T04:00:00Z"),
    platformVersionRevision: 6,
    currentPlatformVersionRevision: 6,
    publishedRevision: 0,
  };

  assert.equal(evaluateScheduleState({ ...base, state: "missed" }).code, "missed_schedule");
  assert.equal(evaluateScheduleState({ ...base, state: "failed" }).code, "failed");
  assert.equal(
    evaluateScheduleState({ ...base, state: "review_required", active: true }).code,
    "review_required",
  );
  assert.equal(evaluateScheduleState({ ...base, state: "succeeded" }).code, "succeeded");
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

const linkedInVersion = {
  ...version,
  platform: "linkedin",
  clientId: "client-A",
  socialConnectionId: "connection-A",
  providerAccountId: "member-A",
};
const linkedInSchedule = {
  ...schedule,
  platform: "linkedin",
  clientId: "client-A",
  socialConnectionId: "connection-A",
  providerAccountId: "member-A",
};

test("LinkedIn scheduled personal post is claimable with the exact saved member", () => {
  assert.deepEqual(
    evaluateScheduledReleaseDispatch({
      schedule: linkedInSchedule,
      version: linkedInVersion,
    }),
    { action: "claim", reason: "ready" },
  );
});

test("LinkedIn scheduled member, client and connection cannot be swapped", () => {
  for (const changed of [
    { clientId: "client-B" },
    { socialConnectionId: "connection-B" },
    { providerAccountId: "member-B" },
    { providerAccountId: "" },
  ]) {
    assert.deepEqual(
      evaluateScheduledReleaseDispatch({
        schedule: { ...linkedInSchedule, ...changed },
        version: linkedInVersion,
      }),
      { action: "noop", reason: "destination_mismatch" },
    );
  }
});

test("LinkedIn cancelled, stale, published and succeeded schedules never resubmit", () => {
  for (const [scheduled, actual] of [
    [{ ...linkedInSchedule, state: "cancelled", active: false }, linkedInVersion],
    [{ ...linkedInSchedule, platformVersionRevision: 5 }, linkedInVersion],
    [linkedInSchedule, { ...linkedInVersion, publishedRevision: 6 }],
    [{ ...linkedInSchedule, state: "succeeded", active: false }, linkedInVersion],
  ]) {
    assert.equal(
      evaluateScheduledReleaseDispatch({ schedule: scheduled, version: actual }).action,
      "noop",
    );
  }
});

test("LinkedIn definite transient errors retry within the shared bound", () => {
  const error = {
    name: "LinkedInPublishProviderError",
    attempt: { status: "failed", providerError: { isTransient: true } },
  };
  assert.equal(
    classifyScheduledDispatchError(error, linkedInSchedule).outcome,
    "retry",
  );
  assert.equal(
    classifyScheduledDispatchError(error, {
      ...linkedInSchedule, retryCount: MAX_SCHEDULED_RELEASE_AUTOMATIC_RETRIES,
    }).outcome,
    "failed",
  );
});

test("LinkedIn ambiguous publish and conflict outcomes lock without retries", () => {
  for (const error of [
    {
      name: "LinkedInPublishProviderError",
      attempt: { status: "unknown", providerError: { isTransient: true } },
    },
    {
      name: "LinkedInPublishConflictError",
      attempt: { status: "submitting" },
    },
  ]) {
    assert.equal(
      classifyScheduledDispatchError(error, linkedInSchedule).outcome,
      "review_required",
    );
  }
});

test("LinkedIn scheduled success stores exact remote ID and URL", () => {
  const data = buildScheduleSuccessFields({
    attempt: {
      _id: "attempt-1",
      providerPostId: "urn:li:ugcPost:1234",
      providerPostUrl: "https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A1234/",
    },
  });
  assert.equal(data.active, false);
  assert.equal(data.providerPostId, "urn:li:ugcPost:1234");
  assert.match(data.providerPostUrl, /linkedin.com\/feed\/update/);
});
