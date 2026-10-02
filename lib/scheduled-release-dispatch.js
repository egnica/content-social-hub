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
  InstagramPublishConflictError,
  InstagramPublishProviderError,
  checkInstagramPublishStatus,
  publishInstagramSingleImageVersion,
} from "@/lib/instagram-publishing";
import {
  checkInstagramCarouselPublishStatus,
  publishInstagramCarouselVersion,
} from "@/lib/instagram-carousel-publishing";
import {
  checkInstagramReelPublishStatus,
  publishInstagramReelVersion,
} from "@/lib/instagram-reel-publishing";
import {
  buildScheduleSuccessFields,
  classifyScheduledDispatchError,
  classifyScheduledNoop,
  classifyScheduledPublishResult,
  evaluateScheduledReleaseDispatch,
  normalizeScheduledReleaseId,
} from "@/lib/scheduled-release-dispatch-logic";
import {
  INSTAGRAM_RECOVERY_IDLE_MS,
  recoverInstagramAttempt,
} from "@/lib/instagram-recovery-logic";

async function collections() {
  const db = await getDb();
  return {
    schedules: db.collection("scheduled_releases"),
    platformVersions: db.collection("platform_versions"),
    publishAttempts: db.collection("publish_attempts"),
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
    reason: "provider_processing",
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
    platform: String(schedule.platform || "").trim().toLowerCase(),
    active: { $ne: false },
  });
}

function instagramPublishMode(version) {
  const mediaCount = Array.isArray(version?.mediaIds) ? version.mediaIds.length : 0;
  if (mediaCount >= 2) return "carousel";
  if (String(version?.mediaMode || "").toLowerCase() === "reel") return "reel";
  return "single_image";
}

async function publishScheduledPlatformVersion(schedule, version) {
  if (schedule.platform === "facebook") {
    return publishFacebookTextLinkVersion(schedule.platformVersionId.toString());
  }

  if (schedule.platform === "instagram") {
    const mode = instagramPublishMode(version);
    if (mode === "carousel") {
      return publishInstagramCarouselVersion(schedule.platformVersionId.toString());
    }
    if (mode === "reel") {
      return publishInstagramReelVersion(schedule.platformVersionId.toString());
    }
    return publishInstagramSingleImageVersion(schedule.platformVersionId.toString());
  }

  throw new TypeError("This scheduled destination platform is not supported.");
}

async function checkScheduledPlatformPublishStatus(schedule, version) {
  if (schedule.platform === "facebook") {
    return checkFacebookVideoPublishStatus(schedule.platformVersionId.toString());
  }

  if (schedule.platform === "instagram") {
    const mode = instagramPublishMode(version);
    if (mode === "carousel") {
      return checkInstagramCarouselPublishStatus(
        schedule.platformVersionId.toString(),
      );
    }
    if (mode === "reel") {
      return checkInstagramReelPublishStatus(schedule.platformVersionId.toString());
    }
    return checkInstagramPublishStatus(schedule.platformVersionId.toString());
  }

  throw new TypeError("This scheduled destination platform is not supported.");
}

function providerResultError(schedule, result, message) {
  if (schedule.platform === "instagram") {
    return new InstagramPublishProviderError(message, result?.attempt || null);
  }
  return new PublishProviderError(message, result?.attempt || null);
}

function isPublishConflict(error) {
  return (
    error instanceof PublishConflictError ||
    error instanceof InstagramPublishConflictError
  );
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
      const result = await publishScheduledPlatformVersion(
        currentSchedule,
        claimedVersion,
      );
      const outcome = classifyScheduledPublishResult(result);

      if (outcome === "succeeded") {
        return markSucceeded(schedules, currentSchedule, result);
      }

      if (outcome === "processing") {
        return attachProcessingState(schedules, currentSchedule, result);
      }

      const error = providerResultError(
        currentSchedule,
        result,
        outcome === "failed"
          ? "The provider returned a definitive scheduled publish failure."
          : "The provider did not return a successful scheduled publish result.",
      );
      return handleDispatchError(schedules, currentSchedule, error);
    } catch (error) {
      if (isPublishConflict(error)) {
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

export async function dispatchScheduledRelease(scheduledReleaseId) {
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
      const result = await checkScheduledPlatformPublishStatus(schedule, version);
      const outcome = classifyScheduledPublishResult(result);

      if (outcome === "succeeded") {
        return markSucceeded(schedules, schedule, result);
      }
      if (outcome === "processing") {
        return attachProcessingState(schedules, schedule, result);
      }

      const error = providerResultError(
        schedule,
        result,
        "Provider processing did not complete successfully.",
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

export const dispatchScheduledFacebookRelease = dispatchScheduledRelease;

export async function recoverScheduledInstagramRelease(
  scheduleId,
  now = new Date(),
) {
  const { schedules, platformVersions, publishAttempts } = await collections();
  const cutoff = new Date(now.getTime() - INSTAGRAM_RECOVERY_IDLE_MS);
  const schedule = await schedules.findOneAndUpdate(
    {
      _id: toObjectId(scheduleId),
      platform: "instagram",
      active: true,
      state: "dispatching",
      updatedAt: { $lte: cutoff },
      $or: [
        { recoveryLeaseUntil: null },
        { recoveryLeaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        recoveryLeaseUntil: new Date(now.getTime() + 5 * 60 * 1000),
        recoveryClaimedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  if (!schedule) return { outcome: "noop", reason: "recovery_not_claimed" };

  // Every recovery write retains its lease and state guard, including terminal writes.
  const guardedSchedules = {
    updateOne: (filter, update) =>
      schedules.updateOne({ ...filter, recoveryClaimedAt: now }, update),
    findOneAndUpdate: (filter, update, options) =>
      schedules.findOneAndUpdate(
        { ...filter, recoveryClaimedAt: now },
        update,
        options,
      ),
  };
  const review = (reason) =>
    markReviewRequired(
      guardedSchedules,
      schedule,
      reason,
      new Error(
        "Interrupted Instagram processing requires review; do not resubmit this revision.",
      ),
    );
  try {
    const version = await reloadVersion(platformVersions, schedule);
    const attempt = version?.lastPublishAttemptId
      ? await publishAttempts.findOne({ _id: version.lastPublishAttemptId })
      : null;
    return await recoverInstagramAttempt({
      schedule,
      version,
      attempt,
      now,
      checkStatus: () => checkScheduledPlatformPublishStatus(schedule, version),
      review,
      succeed: async (result) => {
        // A crash can persist provider success before its destination status. Repair
        // only that exact revision/attempt; this performs no provider request.
        const recorded = await publishAttempts.findOne({
          _id: attempt._id,
          status: "succeeded",
        });
        if (!recorded?.providerPostId)
          return review("recorded_success_unavailable");
        const updatedVersion = await platformVersions.findOneAndUpdate(
          {
            _id: version._id,
            revision: version.revision,
            active: { $ne: false },
            clientId: schedule.clientId,
            lastPublishAttemptId: attempt._id,
          },
          {
            $set: {
              status: "published",
              publishedRevision: version.revision,
              publishedAt: recorded.completedAt || now,
              lastPublishStatus: "succeeded",
              lastPublishError: null,
              providerPostId: recorded.providerPostId,
              providerPostUrl: recorded.providerPostUrl || "",
              providerContainerId: recorded.providerContainerId || "",
              updatedAt: now,
            },
          },
          { returnDocument: "after" },
        );
        if (!updatedVersion) return review("recovery_destination_changed");
        return markSucceeded(guardedSchedules, schedule, {
          ...result,
          platformVersion: serializeDocument(updatedVersion),
          attempt: serializeDocument(recorded),
        });
      },
      processing: async (result, readFailed = false) => {
        await guardedSchedules.updateOne(
          { _id: schedule._id, state: "dispatching", active: true },
          {
            $set: {
              updatedAt: new Date(),
              lastRecoveryAt: now,
              lastRecoveryReadFailed: readFailed,
            },
          },
        );
        return {
          outcome: "processing",
          reason: readFailed ? "recovery_read_failed" : "provider_processing",
          readFailed,
        };
      },
    });
  } finally {
    await guardedSchedules.updateOne(
      { _id: schedule._id },
      { $unset: { recoveryLeaseUntil: "", recoveryClaimedAt: "" } },
    );
  }
}
