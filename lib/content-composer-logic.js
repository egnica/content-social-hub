export function isCurrentRevisionPublished(version) {
  const revision = Number(version?.revision || 0);
  return revision > 0 && Number(version?.publishedRevision || 0) === revision;
}

export function composerStatus(version, scheduleState) {
  if (isCurrentRevisionPublished(version)) return "Published";
  if (
    ["processing", "submitting", "uploading"].includes(
      version?.lastPublishStatus,
    ) ||
    scheduleState?.stateCode === "dispatching"
  )
    return "Publishing";
  if (
    version?.lastPublishStatus === "unknown" ||
    scheduleState?.stateCode === "review_required"
  )
    return "Review required";
  if (
    [
      "failed",
      "missed_schedule",
      "past_release_time",
      "stale_content_revision",
      "unavailable",
    ].includes(scheduleState?.stateCode) ||
    version?.lastPublishStatus === "failed"
  )
    return "Needs attention";
  if (scheduleState?.schedule?.active) return "Scheduled";
  return "Draft";
}

// A copy is source material only. Publication, approval and schedule identities
// must never be carried into a new package.
export function freshContentSource(content) {
  if (!content) return null;
  return {
    internalTitle: `${content.internalTitle || "Content"} (copy)`,
    clientId: content.clientId,
    clientTimezone: content.clientTimezone,
    text: content.text,
    primaryUrl: content.primaryUrl,
    contentLength: content.contentLength,
    media: content.media || [],
    defaultPrimaryMediaId: content.defaultPrimaryMediaId || "",
    defaultVideoThumbnailMediaId: content.defaultVideoThumbnailMediaId || "",
    defaultVideoThumbnail: content.defaultVideoThumbnail || null,
    reusable: false,
    defaultReleaseAt: null,
    defaultReleaseTimezone: null,
  };
}
