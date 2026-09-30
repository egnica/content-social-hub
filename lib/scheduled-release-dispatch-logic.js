const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

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
  if (
    schedule.active !== true ||
    ["cancelled", "superseded", "missed", "succeeded", "failed"].includes(state)
  ) {
    return { action: "noop", reason: state || "inactive_schedule" };
  }

  if (String(schedule.platform || "").trim().toLowerCase() !== "facebook") {
    return { action: "noop", reason: "unsupported_platform" };
  }

  if (!version || version.active === false) {
    return { action: "noop", reason: "destination_unavailable" };
  }

  if (id(schedule.platformVersionId) !== id(version)) {
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
      return { action: "refresh_processing", reason: "video_processing" };
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
