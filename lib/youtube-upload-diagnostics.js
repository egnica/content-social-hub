import { safeYouTubeThumbnailUrl, youtubeThumbnailStatusLabel } from "./youtube-thumbnail-logic.js";
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
  const probe = attempt.uploadSessionCheck && typeof attempt.uploadSessionCheck === "object" ?
    attempt.uploadSessionCheck : null;
  const thumbnailCheck = attempt.thumbnailProviderCheck && typeof attempt.thumbnailProviderCheck === "object" ?
    attempt.thumbnailProviderCheck : null;


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
    thumbnailLabel: youtubeThumbnailStatusLabel(attempt),
    thumbnailProviderCheck: thumbnailCheck ? {
      checkedAt: safeDate(thumbnailCheck.checkedAt),
      result: ["reported", "not_reported", "unavailable"].includes(thumbnailCheck.result) ?
        thumbnailCheck.result : "unavailable",
      url: safeYouTubeThumbnailUrl(thumbnailCheck.url, videoId),
      message: typeof thumbnailCheck.message === "string" ? thumbnailCheck.message.slice(0, 200) : null,
    } : null,
    thumbnailError: safeError(attempt.thumbnailError),
    lastError: safeError(attempt.providerError),
    youtubeSessionCheck: probe ? {
      checkedAt: safeDate(probe.checkedAt),
      result: ["incomplete", "complete", "expired", "authorization_required", "unavailable"].includes(probe.result) ?
        probe.result : "unavailable",
      confirmedBytes: Number.isSafeInteger(probe.confirmedBytes) && probe.confirmedBytes >= 0 ?
        probe.confirmedBytes : null,
      httpStatus: Number.isInteger(probe.httpStatus) && probe.httpStatus >= 100 && probe.httpStatus <= 599 ?
        probe.httpStatus : null,
      videoId: VIDEO_ID.test(String(probe.videoId || "")) ? probe.videoId : null,
      message: safeError(probe.message),
    } : null,
  };
}

/** Converts a zero-byte YouTube resumable-session status response into safe, persisted diagnostics. */
export function buildYouTubeSessionCheck({ state = null, error = null, size, now = new Date() } = {}) {
  const checkedAt = safeDate(now);
  if (error) {
    const code = Number(error.status);
    const httpStatus = Number.isInteger(code) && code >= 400 && code <= 599 ? code : null;
    const result = httpStatus === 404 || httpStatus === 410 ? "expired" :
      httpStatus === 401 || httpStatus === 403 ? "authorization_required" : "unavailable";
    const message = result === "expired" ?
      "The saved YouTube session is no longer available. Do not start another upload until reconciled." :
      result === "authorization_required" ? "YouTube authorization is unavailable for this session check." :
      "YouTube could not confirm the saved session. No video bytes were transferred.";
    return { checkedAt, result, confirmedBytes: null, httpStatus, videoId: null, message };
  }
  if (state?.completed) {
    const id = String(state.completed.videoId || "");
    if (!VIDEO_ID.test(id)) {
      return { checkedAt, result: "unavailable", confirmedBytes: null, httpStatus: null,
        videoId: null, message: "YouTube returned an unrecognized completed video ID." };
    }
    return { checkedAt, result: "complete", confirmedBytes: Number(size),
      httpStatus: null, videoId: id,
      message: "YouTube reports upload completion. The app's publish record has not been changed." };
  }
  const offset = Number(state?.offset);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset >= Number(size)) {
    return { checkedAt, result: "unavailable", confirmedBytes: null, httpStatus: null,
      videoId: null, message: "YouTube did not return a valid upload offset." };
  }
  return { checkedAt, result: "incomplete", confirmedBytes: offset, httpStatus: 308,
    videoId: null, message: "YouTube confirmed the received byte count. No bytes were sent by this check." };
}
