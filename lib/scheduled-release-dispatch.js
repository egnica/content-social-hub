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
        publishAttemptId: publishAttemptId || fields.publishAttemptId || null,
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

async function markFailed(schedules, schedule, error) {
  const completedAt = new Date();
  await schedules.updateOne(
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
        failure: failureView(error),
        updatedAt: completedAt,
      },
    },
  );
}

async function reloadVersion(platformVersions, schedule) {
  return platformVersions.findOne({
    _id: schedule.platformVersionId,
    platform: "facebook",
    active: { $ne: false },
  });
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
    return {
      outcome: "noop",
      reason: decision.reason,
      schedule: schedule ? serializeDocument(schedule) : null,
    };
  }

  if (decision.action === "refresh_processing") {
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
    await markFailed(schedules, schedule, error);
    throw error;
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
        updatedAt: dispatchedAt,
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
    await schedules.updateOne(
      { _id: claimed._id, state: "dispatching", dispatchedAt },
      {
        $set: {
          state: "scheduled",
          dispatchedAt: null,
          updatedAt: new Date(),
        },
      },
    );

    return {
      outcome: "noop",
      reason:
        publishedRevision === claimedRevision
          ? "already_published_revision"
          : "stale_content_revision",
    };
  }

  try {
    const result = await publishFacebookTextLinkVersion(
      claimed.platformVersionId.toString(),
    );
    const outcome = classifyScheduledPublishResult(result);

    if (outcome === "succeeded") {
      return markSucceeded(schedules, claimed, result);
    }

    if (outcome === "processing") {
      return attachProcessingState(schedules, claimed, result);
    }

    const error = new PublishProviderError(
      "Facebook did not return a successful scheduled publish result.",
      result?.attempt || null,
    );
    await markFailed(schedules, claimed, error);
    throw error;
  } catch (error) {
    if (error instanceof PublishConflictError) {
      const attemptStatus = String(error.attempt?.status || "").toLowerCase();
      if (attemptStatus === "succeeded") {
        return markSucceeded(schedules, claimed, {
          platformVersion: claimedVersion,
          attempt: error.attempt,
        });
      }
      if (attemptStatus === "processing") {
        return attachProcessingState(schedules, claimed, {
          platformVersion: claimedVersion,
          attempt: error.attempt,
        });
      }
    }

    await markFailed(schedules, claimed, error);
    throw error;
  }
}
