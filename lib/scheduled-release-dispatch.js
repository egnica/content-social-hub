import "server-only";

import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import {
  PublishConflictError,
  PublishProviderError,
  checkFacebookVideoPublishStatus,
  publishFacebookTextLinkVersion,
} from "@/lib/publishing";
import {
  buildScheduleSuccessFields,
  classifyScheduledDispatchError,
  classifyScheduledNoop,
  classifyScheduledPublishResult,
  evaluateScheduledReleaseDispatch,
  normalizeScheduledReleaseId,
} from "@/lib/scheduled-release-dispatch-logic";

async function collections() {
  const db = await getDb();
  return {
    schedules: db.collection("scheduled_releases"),
    platformVersions: db.collection("platform_versions"),
  };
}

function failureView(error) {
  return {
    name: String(error?.name || "ScheduledReleaseDispatchError"),
    message: String(error?.message || "Scheduled release dispatch failed."),
    attemptStatus: String(error?.attempt?.status || ""),
    providerError: error?.attempt?.providerError || null,
  };
}

function historyEntry(state, reason, at = new Date(), extra = {}) {
  return {
    state,
    reason,
    at,
    ...extra,
  };
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function attachProcessingState(schedules, schedule, result) {
  const now = new Date();
  const attempt = result?.attempt || {};
  const version = result?.platformVersion || {};

  await schedules.updateOne(
    {
      _id: schedule._id,
      state: "dispatching",
      active: true,
    },
    {
      $set: {
        publishAttemptId: toObjectId(attempt._id) || version.lastPublishAttemptId || null,
        providerPostId: attempt.providerPostId || version.providerPostId || "",
        providerPostUrl: attempt.providerPostUrl || version.providerPostUrl || "",
        updatedAt: now,
      },
    },
  );

  return {
    outcome: "processing",
    reason: "video_processing",
    scheduleId: schedule._id.toString(),
    platformVersionId: schedule.platformVersionId.toString(),
    platformVersionRevision: Number(schedule.platformVersionRevision || 0),
    attempt: result?.attempt || null,
  };
}

async function markSucceeded(schedules, schedule, result) {
  const completedAt = new Date();
  const fields = buildScheduleSuccessFields(result, completedAt);
  const publishAttemptId = toObjectId(fields.publishAttemptId);

  const updated = await schedules.findOneAndUpdate(
    {
      _id: schedule._id,
      state: "dispatching",
      active: true,
      platformVersionRevision: Number(schedule.platformVersionRevision || 0),
    },
    {
      $set: {
        ...fields,
        retryPending: false,
        nextRetryAt: null,
        publishAttemptId: publishAttemptId || fields.publishAttemptId || null,
      },
      $push: {
        transitionHistory: historyEntry("succeeded", "published", completedAt),
      },
    },
    { returnDocument: "after" },
  );

  return {
    outcome: "succeeded",
    reason: "published",
    schedule: serializeDocument(updated || schedule),
    platformVersion: result?.platformVersion || null,
    attempt: result?.attempt || null,
  };
}

async function markMissed(schedules, schedule, reason, error = null) {
  const completedAt = new Date();
  const failure = error ? failureView(error) : null;
  const updated = await schedules.findOneAndUpdate(
    {
      _id: schedule._id,
      active: true,
    },
    {
      $set: {
        state: "missed",
        active: false,
        completedAt,
        missedAt: completedAt,
        missedReason: reason,
        retryPending: false,
        nextRetryAt: null,
        failure,
        updatedAt: completedAt,
      },
      $push: {
        transitionHistory: historyEntry("missed", reason, completedAt),
      },
    },
    { returnDocument: "after" },
  );

  return {
    outcome: "missed",
    reason,
    schedule: serializeDocument(updated || schedule),
  };
}

async function markFailed(schedules, schedule, reason, error) {
  const completedAt = new Date();
  const updated = await schedules.findOneAndUpdate(
    {
      _id: schedule._id,
      state: "dispatching",
      active: true,
    },
    {
      $set: {
        state: "failed",
        active: false,
        completedAt,
        retryPending: false,
        nextRetryAt: null,
        publishAttemptId:
          toObjectId(error?.attempt?._id) || schedule.publishAttemptId || null,
        providerPostId:
          error?.attempt?.providerPostId || schedule.providerPostId || "",
        providerPostUrl:
          error?.attempt?.providerPostUrl || schedule.providerPostUrl || "",
        failure: failureView(error),
        updatedAt: completedAt,
      },
      $push: {
        transitionHistory: historyEntry("failed", reason, completedAt, {
          retryCount: Number(schedule.retryCount || 0),
        }),
      },
    },
    { returnDocument: "after" },
  );

  return {
    outcome: "failed",
    reason,
    schedule: serializeDocument(updated || schedule),
    attempt: error?.attempt || null,
  };
}

async function markReviewRequired(schedules, schedule, reason, error) {
  const reviewRequiredAt = new Date();
  const updated = await schedules.findOneAndUpdate(
    {
      _id: schedule._id,
      state: "dispatching",
      active: true,
    },
    {
      $set: {
        state: "review_required",
        active: true,
        reviewRequiredAt,
        retryPending: false,
        nextRetryAt: null,
        publishAttemptId:
          toObjectId(error?.attempt?._id) || schedule.publishAttemptId || null,
        providerPostId:
          error?.attempt?.providerPostId || schedule.providerPostId || "",
        providerPostUrl:
          error?.attempt?.providerPostUrl || schedule.providerPostUrl || "",
        failure: failureView(error),
        updatedAt: reviewRequiredAt,
      },
      $push: {
        transitionHistory: historyEntry(
          "review_required",
          reason,
          reviewRequiredAt,
          { retryCount: Number(schedule.retryCount || 0) },
        ),
      },
    },
    { returnDocument: "after" },
  );

  return {
    outcome: "review_required",
    reason,
    schedule: serializeDocument(updated || schedule),
    attempt: error?.attempt || null,
  };
}

async function scheduleAutomaticRetry(schedules, schedule, disposition, error) {
  const retryScheduledAt = new Date();
  const retryCount = Number(schedule.retryCount || 0) + 1;
  const nextRetryAt = new Date(
    retryScheduledAt.getTime() + Number(disposition.retryDelayMs || 0),
  );
  const updated = await schedules.findOneAndUpdate(
    {
      _id: schedule._id,
      state: "dispatching",
      active: true,
      retryCount: Number(schedule.retryCount || 0),
    },
    {
      $set: {
        retryCount,
        retryPending: true,
        nextRetryAt,
        failure: failureView(error),
        updatedAt: retryScheduledAt,
      },
      $push: {
        transitionHistory: historyEntry(
          "dispatching",
          "automatic_retry_scheduled",
          retryScheduledAt,
          { retryCount, nextRetryAt },
        ),
      },
    },
    { returnDocument: "after" },
  );

  return updated;
}

async function beginAutomaticRetry(schedules, schedule) {
  const startedAt = new Date();
  return schedules.findOneAndUpdate(
    {
      _id: schedule._id,
      state: "dispatching",
      active: true,
      retryPending: true,
      retryCount: Number(schedule.retryCount || 0),
    },
    {
      $set: {
        retryPending: false,
        nextRetryAt: null,
        lastRetryAt: startedAt,
        updatedAt: startedAt,
      },
      $push: {
        transitionHistory: historyEntry(
          "dispatching",
          "automatic_retry_started",
          startedAt,
          { retryCount: Number(schedule.retryCount || 0) },
        ),
      },
    },
    { returnDocument: "after" },
  );
}

async function reloadVersion(platformVersions, schedule) {
  return platformVersions.findOne({
    _id: schedule.platformVersionId,
    platform: "facebook",
    active: { $ne: false },
  });
}

async function handleDispatchError(schedules, schedule, error) {
  const disposition = classifyScheduledDispatchError(error, schedule);

  if (disposition.outcome === "missed") {
    return markMissed(schedules, schedule, disposition.reason, error);
  }

  if (disposition.outcome === "failed") {
    return markFailed(schedules, schedule, disposition.reason, error);
  }

  if (disposition.outcome === "review_required") {
    return markReviewRequired(schedules, schedule, disposition.reason, error);
  }

  if (disposition.outcome !== "retry") {
    return markReviewRequired(
      schedules,
      schedule,
      "unexpected_dispatch_classification",
      error,
    );
  }

  const retrySchedule = await scheduleAutomaticRetry(
    schedules,
    schedule,
    disposition,
    error,
  );
  if (!retrySchedule) {
    return {
      outcome: "noop",
      reason: "automatic_retry_claim_lost",
      schedule: serializeDocument(
        await schedules.findOne({ _id: schedule._id }),
      ),
    };
  }

  await sleep(Number(disposition.retryDelayMs || 0));
  const retrying = await beginAutomaticRetry(schedules, retrySchedule);
  if (!retrying) {
    return {
      outcome: "noop",
      reason: "automatic_retry_cancelled",
      schedule: serializeDocument(
        await schedules.findOne({ _id: schedule._id }),
      ),
    };
  }

  return { outcome: "retry", schedule: retrying };
}

async function publishClaimedRelease(schedules, schedule, claimedVersion) {
  let currentSchedule = schedule;

  while (true) {
    try {
      const result = await publishFacebookTextLinkVersion(
        currentSchedule.platformVersionId.toString(),
      );
      const outcome = classifyScheduledPublishResult(result);

      if (outcome === "succeeded") {
        return markSucceeded(schedules, currentSchedule, result);
      }

      if (outcome === "processing") {
        return attachProcessingState(schedules, currentSchedule, result);
      }

      const error = new PublishProviderError(
        "Facebook did not return a successful scheduled publish result.",
        result?.attempt || null,
      );
      return markReviewRequired(
        schedules,
        currentSchedule,
        "ambiguous_provider_outcome",
        error,
      );
    } catch (error) {
      if (error instanceof PublishConflictError) {
        const attemptStatus = String(error.attempt?.status || "").toLowerCase();
        if (attemptStatus === "succeeded") {
          return markSucceeded(schedules, currentSchedule, {
            platformVersion: claimedVersion,
            attempt: error.attempt,
          });
        }
        if (attemptStatus === "processing") {
          return attachProcessingState(schedules, currentSchedule, {
            platformVersion: claimedVersion,
            attempt: error.attempt,
          });
        }
      }

      const handled = await handleDispatchError(
        schedules,
        currentSchedule,
        error,
      );
      if (handled.outcome !== "retry") return handled;
      currentSchedule = handled.schedule;
    }
  }
}

export async function dispatchScheduledFacebookRelease(scheduledReleaseId) {
  const normalizedId = normalizeScheduledReleaseId(scheduledReleaseId);
  if (!normalizedId) {
    return { outcome: "noop", reason: "invalid_schedule_id" };
  }

  const scheduleId = toObjectId(normalizedId);
  const { schedules, platformVersions } = await collections();
  const schedule = await schedules.findOne({ _id: scheduleId });
  const version = schedule ? await reloadVersion(platformVersions, schedule) : null;
  const decision = evaluateScheduledReleaseDispatch({ schedule, version });

  if (decision.action === "noop") {
    const disposition = classifyScheduledNoop(decision.reason);
    if (disposition.outcome === "missed" && schedule?.active === true) {
      return markMissed(schedules, schedule, disposition.reason);
    }

    return {
      outcome: "noop",
      reason: decision.reason,
      schedule: schedule ? serializeDocument(schedule) : null,
    };
  }

  if (decision.action === "refresh_processing") {
    try {
      const result = await checkFacebookVideoPublishStatus(
        schedule.platformVersionId.toString(),
      );
      const outcome = classifyScheduledPublishResult(result);

      if (outcome === "succeeded") {
        return markSucceeded(schedules, schedule, result);
      }
      if (outcome === "processing") {
        return attachProcessingState(schedules, schedule, result);
      }

      const error = new PublishProviderError(
        "Facebook video processing did not complete successfully.",
        result?.attempt || null,
      );
      return handleDispatchError(schedules, schedule, error);
    } catch (error) {
      return handleDispatchError(schedules, schedule, error);
    }
  }

  const dispatchedAt = new Date();
  const claimed = await schedules.findOneAndUpdate(
    {
      _id: schedule._id,
      active: true,
      state: "scheduled",
      dispatchedAt: null,
      platformVersionRevision: Number(schedule.platformVersionRevision || 0),
    },
    {
      $set: {
        state: "dispatching",
        dispatchedAt,
        retryCount: 0,
        retryPending: false,
        nextRetryAt: null,
        updatedAt: dispatchedAt,
      },
      $push: {
        transitionHistory: historyEntry(
          "dispatching",
          "release_time_reached",
          dispatchedAt,
        ),
      },
    },
    { returnDocument: "after" },
  );

  if (!claimed) {
    return {
      outcome: "noop",
      reason: "dispatch_claim_lost",
      schedule: serializeDocument(await schedules.findOne({ _id: schedule._id })),
    };
  }

  // Re-read after the atomic claim so a content edit that won the race before
  // dispatch cannot silently publish under the older schedule binding.
  const claimedVersion = await reloadVersion(platformVersions, claimed);
  const claimedRevision = Number(claimed.platformVersionRevision || 0);
  const currentRevision = Number(claimedVersion?.revision || 0);
  const publishedRevision = Number(claimedVersion?.publishedRevision || 0);

  if (
    !claimedVersion ||
    currentRevision !== claimedRevision ||
    publishedRevision === claimedRevision
  ) {
    return markMissed(
      schedules,
      claimed,
      publishedRevision === claimedRevision
        ? "already_published_revision"
        : "stale_content_revision",
    );
  }

  return publishClaimedRelease(schedules, claimed, claimedVersion);
}
