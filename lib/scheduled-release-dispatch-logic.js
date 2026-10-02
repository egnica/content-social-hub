const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

export const MAX_SCHEDULED_RELEASE_AUTOMATIC_RETRIES = 2;
export const SCHEDULED_RELEASE_RETRY_DELAY_MS = 5000;

const SUPPORTED_SCHEDULE_PLATFORMS = new Set(["facebook", "instagram"]);

const MISSED_NOOP_REASONS = new Set([
  "stale_content_revision",
  "already_published_revision",
  "destination_unavailable",
  "destination_mismatch",
  "unsupported_platform",
]);

function id(value) {
  return String(value?._id ?? value ?? "");
}

export function normalizeScheduledReleaseId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return OBJECT_ID_PATTERN.test(normalized) ? normalized : "";
}

export function evaluateScheduledReleaseDispatch({ schedule, version } = {}) {
  if (!schedule) return { action: "noop", reason: "schedule_not_found" };

  const state = String(schedule.state || "").trim().toLowerCase();
  if (state === "review_required") {
    return { action: "noop", reason: "review_required" };
  }

  if (
    schedule.active !== true ||
    ["cancelled", "superseded", "missed", "succeeded", "failed"].includes(state)
  ) {
    return { action: "noop", reason: state || "inactive_schedule" };
  }

  const schedulePlatform = String(schedule.platform || "").trim().toLowerCase();
  const versionPlatform = String(version?.platform || "").trim().toLowerCase();

  if (!SUPPORTED_SCHEDULE_PLATFORMS.has(schedulePlatform)) {
    return { action: "noop", reason: "unsupported_platform" };
  }

  if (!version || version.active === false) {
    return { action: "noop", reason: "destination_unavailable" };
  }

  if (
    id(schedule.platformVersionId) !== id(version) ||
    (versionPlatform && schedulePlatform !== versionPlatform)
  ) {
    return { action: "noop", reason: "destination_mismatch" };
  }

  const scheduledRevision = Number(schedule.platformVersionRevision || 0);
  const currentRevision = Number(version.revision || 0);
  const publishedRevision = Number(version.publishedRevision || 0);

  if (!scheduledRevision || scheduledRevision !== currentRevision) {
    return { action: "noop", reason: "stale_content_revision" };
  }

  if (publishedRevision === scheduledRevision) {
    return { action: "noop", reason: "already_published_revision" };
  }

  if (state === "scheduled" && !schedule.dispatchedAt) {
    return { action: "claim", reason: "ready" };
  }

  if (state === "dispatching" && schedule.dispatchedAt) {
    if (String(version.lastPublishStatus || "").toLowerCase() === "processing") {
      return { action: "refresh_processing", reason: "provider_processing" };
    }
    return { action: "noop", reason: "dispatch_in_progress" };
  }

  return { action: "noop", reason: "schedule_not_dispatchable" };
}

export function classifyScheduledPublishResult(result = {}) {
  const attempt = result.attempt || {};
  const version = result.platformVersion || {};
  const attemptStatus = String(attempt.status || "").trim().toLowerCase();
  const versionStatus = String(version.lastPublishStatus || version.status || "")
    .trim()
    .toLowerCase();

  if (
    attemptStatus === "succeeded" ||
    versionStatus === "succeeded" ||
    version.status === "published"
  ) {
    return "succeeded";
  }

  if (attemptStatus === "processing" || versionStatus === "processing") {
    return "processing";
  }

  if (attemptStatus === "failed" || versionStatus === "failed") {
    return "failed";
  }

  return "unknown";
}

export function classifyScheduledNoop(reason) {
  const normalized = String(reason || "").trim().toLowerCase();
  if (MISSED_NOOP_REASONS.has(normalized)) {
    return { outcome: "missed", state: "missed", reason: normalized };
  }

  return { outcome: "noop", state: null, reason: normalized || "noop" };
}

export function classifyScheduledDispatchError(error = {}, schedule = {}) {
  const name = String(error?.name || "").trim();
  const attempt = error?.attempt || {};
  const attemptStatus = String(attempt.status || "").trim().toLowerCase();
  const providerError = attempt.providerError || {};
  const retryCount = Math.max(0, Number(schedule.retryCount || 0));
  const providerErrorName =
    name === "PublishProviderError" || name === "InstagramPublishProviderError";
  const conflictErrorName =
    name === "PublishConflictError" || name === "InstagramPublishConflictError";

  if (name === "TypeError") {
    return {
      outcome: "missed",
      state: "missed",
      reason: "publish_blocked",
      retryable: false,
    };
  }

  if (providerErrorName && attemptStatus === "failed") {
    if (
      providerError.isTransient === true &&
      retryCount < MAX_SCHEDULED_RELEASE_AUTOMATIC_RETRIES
    ) {
      return {
        outcome: "retry",
        state: "dispatching",
        reason: "transient_provider_failure",
        retryable: true,
        retryDelayMs: SCHEDULED_RELEASE_RETRY_DELAY_MS,
      };
    }

    return {
      outcome: "failed",
      state: "failed",
      reason:
        providerError.isTransient === true
          ? "automatic_retry_exhausted"
          : "definitive_provider_failure",
      retryable: false,
    };
  }

  if (providerErrorName || conflictErrorName) {
    return {
      outcome: "review_required",
      state: "review_required",
      reason: "ambiguous_provider_outcome",
      retryable: false,
    };
  }

  return {
    outcome: "review_required",
    state: "review_required",
    reason: "unexpected_dispatch_error",
    retryable: false,
  };
}

export function buildScheduleSuccessFields(result = {}, completedAt = new Date()) {
  const attempt = result.attempt || {};
  const version = result.platformVersion || {};

  return {
    state: "succeeded",
    active: false,
    completedAt,
    updatedAt: completedAt,
    publishAttemptId: attempt._id || version.lastPublishAttemptId || null,
    providerPostId: attempt.providerPostId || version.providerPostId || "",
    providerPostUrl: attempt.providerPostUrl || version.providerPostUrl || "",
    failure: null,
  };
}
