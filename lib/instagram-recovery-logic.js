export const INSTAGRAM_RECOVERY_IDLE_MS = 20 * 60 * 1000;
export const INSTAGRAM_RECOVERY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const same = (left, right) =>
  Boolean(left && right) && String(left) === String(right);

export function evaluateInstagramRecovery({
  schedule,
  version,
  attempt,
  now = new Date(),
}) {
  if (
    schedule?.platform !== "instagram" ||
    !schedule.active ||
    schedule.state !== "dispatching"
  ) {
    return { action: "skip", reason: "not_dispatching" };
  }
  const idleSince = new Date(
    schedule.updatedAt || schedule.dispatchedAt,
  ).getTime();
  if (
    !Number.isFinite(idleSince) ||
    now.getTime() - idleSince < INSTAGRAM_RECOVERY_IDLE_MS
  ) {
    return { action: "skip", reason: "worker_recently_active" };
  }
  if (
    !version ||
    version.active === false ||
    version.platform !== "instagram" ||
    !same(schedule.platformVersionId, version._id) ||
    !same(schedule.clientId, version.clientId) ||
    Number(schedule.platformVersionRevision) !== Number(version.revision)
  ) {
    return { action: "review", reason: "recovery_destination_changed" };
  }
  if (
    !attempt ||
    attempt.platform !== "instagram" ||
    !same(version.lastPublishAttemptId, attempt._id) ||
    (schedule.publishAttemptId &&
      !same(schedule.publishAttemptId, attempt._id)) ||
    !same(attempt.platformVersionId, version._id) ||
    !same(attempt.clientId, version.clientId) ||
    !same(attempt.socialConnectionId, version.socialConnectionId) ||
    Number(attempt.platformVersionRevision) !==
      Number(schedule.platformVersionRevision)
  ) {
    return { action: "review", reason: "recovery_attempt_mismatch" };
  }
  if (attempt.status === "succeeded" && attempt.providerPostId) {
    return { action: "succeeded", reason: "recorded_provider_success" };
  }
  const started = new Date(attempt.startedAt || attempt.createdAt).getTime();
  if (
    !Number.isFinite(started) ||
    now.getTime() - started >= INSTAGRAM_RECOVERY_MAX_AGE_MS
  ) {
    return { action: "review", reason: "processing_recovery_window_expired" };
  }
  const mode =
    (version.mediaIds || []).length >= 2
      ? "carousel"
      : version.mediaMode === "reel"
        ? "reel"
        : "single_image";
  const hasContainers =
    mode === "carousel"
      ? Array.isArray(attempt.providerMedia) &&
        attempt.providerMedia.length === version.mediaIds.length &&
        attempt.providerMedia.every(
          (item, index) =>
            item.providerContainerId &&
            same(item.mediaAssetId, version.mediaIds[index]),
        )
      : Boolean(attempt.providerContainerId);
  if (
    attempt.status !== "processing" ||
    attempt.publishMode !== mode ||
    !hasContainers
  ) {
    return { action: "review", reason: "unresolved_provider_submission" };
  }
  return { action: "resume", reason: "recorded_provider_processing" };
}

// This runner intentionally receives no publish/retry function. Recovery can only
// inspect/continue the saved attempt or reconcile a recorded success.
export async function recoverInstagramAttempt({
  schedule,
  version,
  attempt,
  now,
  checkStatus,
  succeed,
  review,
  processing,
}) {
  const decision = evaluateInstagramRecovery({
    schedule,
    version,
    attempt,
    now,
  });
  if (decision.action === "skip")
    return { outcome: "noop", reason: decision.reason };
  if (decision.action === "review") return review(decision.reason);
  if (decision.action === "succeeded")
    return succeed({ platformVersion: version, attempt });
  try {
    const result = await checkStatus();
    // Trust the attempt, not a loosely aggregated version status.
    if (
      result?.attempt?.status === "succeeded" &&
      result.attempt.providerPostId
    )
      return succeed(result);
    if (result?.attempt?.status === "processing") return processing(result);
    return review("recovery_provider_result_requires_review");
  } catch (error) {
    if (
      error?.name?.includes("Conflict") ||
      (error?.attempt?.status && error.attempt.status !== "processing")
    ) {
      return review("recovery_provider_result_requires_review");
    }
    // A read/network failure is not proof that publishing failed. Keep its lock.
    return processing(null, true);
  }
}
