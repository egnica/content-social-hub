export function getFacebookPublishControlState({
  status = "",
  publishedRevision = 0,
  revision = 0,
} = {}) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const currentRevision = Number(revision || 0);
  const successfulRevision = Number(publishedRevision || 0);

  if (
    normalizedStatus === "succeeded" &&
    currentRevision > 0 &&
    successfulRevision === currentRevision
  ) {
    return {
      mode: "published",
      canSubmit: false,
      label: "Published",
    };
  }

  if (["submitting", "uploading", "processing"].includes(normalizedStatus)) {
    return {
      mode: "processing",
      canSubmit: false,
      label: normalizedStatus === "processing" ? "Video Processing" : "Publishing…",
    };
  }

  if (normalizedStatus === "unknown") {
    return {
      mode: "locked",
      canSubmit: false,
      label: "Review Required",
    };
  }

  if (normalizedStatus === "failed") {
    return {
      mode: "retry",
      canSubmit: true,
      label: "Retry Publish",
    };
  }

  return {
    mode: "ready",
    canSubmit: true,
    label: "Publish Now",
  };
}

export function isAttemptForRevision(attempt, revision) {
  if (!attempt) return false;
  return Number(attempt.platformVersionRevision || 0) === Number(revision || 0);
}
