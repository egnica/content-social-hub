// Read-only projection of a YouTube publish attempt for the owner-facing editor.
// Do not add encrypted upload sessions, OAuth credentials, object keys or provider request URLs.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function safeDate(value) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function safeError(value) {
  const message = typeof value === "string" ? value :
    (value && typeof value.message === "string" ? value.message : "");
  return message
    .replace(/https?:\/\/\S+/gi, "[URL redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 320) || null;
}

export function summarizeYouTubeUploadDiagnostics(attempt, video, now = Date.now()) {
  if (!attempt) return null;

  const size = Number(video?.size);
  const expectedBytes = Number.isSafeInteger(size) && size > 0 ? size : null;
  const bytes = Number(attempt.bytesUploaded);
  const recordedBytes = Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : 0;
  const stepStartedAt = safeDate(attempt.uploadStepStartedAt);
  const stepAgeMs = stepStartedAt ? Number(now) - new Date(stepStartedAt).getTime() : null;
  const stepState = !stepStartedAt ? "idle" :
    (stepAgeMs !== null && stepAgeMs >= 3 * 60 * 1000 ? "stale (eligible for session check)" : "in progress");
  const videoId = VIDEO_ID.test(String(attempt.providerVideoId || "")) ?
    String(attempt.providerVideoId) : null;
  const provider = attempt.providerStatus && typeof attempt.providerStatus === "object" ?
    attempt.providerStatus : {};

  return {
    attemptId: String(attempt._id || ""),
    revision: Number.isInteger(Number(attempt.platformVersionRevision)) ?
      Number(attempt.platformVersionRevision) : null,
    status: String(attempt.status || "unknown"),
    sessionState: attempt.uploadSessionEncrypted ? "saved (not verified with YouTube)" : "not saved",
    recordedBytes,
    expectedBytes,
    percentRecorded: expectedBytes ? Math.min(100, Math.round(1000 * recordedBytes / expectedBytes) / 10) : null,
    stepState,
    stepStartedAt,
    startedAt: safeDate(attempt.startedAt || attempt.createdAt),
    lastUpdatedAt: safeDate(attempt.updatedAt),
    videoId,
    videoUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
    providerUploadStatus: typeof provider.uploadStatus === "string" ? provider.uploadStatus.slice(0, 60) : null,
    providerProcessingStatus: typeof provider.processingStatus === "string" ? provider.processingStatus.slice(0, 60) : null,
    thumbnailStatus: String(attempt.thumbnailStatus || (attempt.thumbnailApplied ? "applied" : "not confirmed")),
    thumbnailError: safeError(attempt.thumbnailError),
    lastError: safeError(attempt.providerError),
  };
}
