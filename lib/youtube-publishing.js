import "server-only";
import { getDb } from "@/lib/mongodb";
import { toObjectId, serializeDocument } from "@/lib/ids";
import { refreshSocialConnectionHealth } from "@/lib/connections";
import { encryptSecret, decryptSecret } from "@/lib/secure-values";
import { readMediaObject, readMediaObjectRange } from "@/lib/s3";
import { prepareYouTubeDescription, validateYouTubeVersionDraft } from "@/lib/platform-version-logic";
import { summarizeYouTubeUploadDiagnostics, buildYouTubeSessionCheck } from "@/lib/youtube-upload-diagnostics";
import {
  startYouTubeResumableUpload, probeYouTubeResumableUpload, sendYouTubeUploadChunk,
  nextYouTubeChunkEnd, readYouTubeVideoProcessing, setYouTubeThumbnail, youtubeVideoUrl,
} from "@/lib/youtube-uploader";

export class YouTubePublishConflictError extends Error {
  constructor(message, attempt = null) { super(message); this.name = "YouTubePublishConflictError"; this.attempt = attempt; }
}
export class YouTubePublishProviderError extends Error {
  constructor(message, attempt = null) { super(message); this.name = "YouTubePublishProviderError"; this.attempt = attempt; }
}
const safeAttempt = attempt => serializeDocument(attempt && Object.fromEntries(
  Object.entries(attempt).filter(([key]) => key !== "uploadSessionEncrypted")));
const safeOutput = (version, attempt) => ({ platformVersion: serializeDocument(version), attempt: safeAttempt(attempt) });

async function load(id) {
  const _id = toObjectId(id);
  if (!_id) throw new TypeError("YouTube destination not found.");
  const db = await getDb();
  const versions = db.collection("platform_versions"), attempts = db.collection("publish_attempts");
  const version = await versions.findOne({ _id, platform: "youtube", active: { $ne: false } });
  if (!version) throw new TypeError("YouTube destination not found.");
  const [master, connection] = await Promise.all([
    db.collection("master_content").findOne({ _id: version.masterContentId }),
    db.collection("social_connections").findOne({ _id: version.socialConnectionId }),
  ]);
  if (!master || !connection || String(master.clientId) !== String(version.clientId) ||
      String(connection.clientId) !== String(version.clientId) || connection.platform !== "youtube" ||
      String(connection.providerAccountId) !== String(version.providerAccountId))
    throw new TypeError("YouTube channel no longer belongs to this destination and client.");
  const ids = version.mediaIds || [];
  const video = ids.length === 1 ? await db.collection("media_assets").findOne({
    _id: ids[0], clientId: version.clientId, status: "uploaded",
  }) : null;
  const thumbnail = version.videoThumbnailMediaId ? await db.collection("media_assets").findOne({
    _id: version.videoThumbnailMediaId, clientId: version.clientId, status: "uploaded",
  }) : null;
  return { version, master, connection, video, thumbnail, versions, attempts, db };
}
async function credentials(ctx) {
  await refreshSocialConnectionHealth(String(ctx.connection._id));
  const latest = await ctx.db.collection("social_connections").findOne({
    _id: ctx.connection._id, clientId: ctx.version.clientId,
    platform: "youtube", providerAccountId: ctx.version.providerAccountId,
  });
  if (!latest || latest.healthStatus !== "healthy" || latest.capabilities?.canPublish !== true || !latest.tokenEncrypted)
    throw new TypeError("YouTube authorization needs reconnection before upload.");
  return decryptSecret(latest.tokenEncrypted);
}
async function snapshot(ctx) {
  const { version, master, video, thumbnail } = ctx;
  if (!video || !Number.isSafeInteger(Number(video.size)) || Number(video.size) <= 0)
    throw new TypeError("Selected YouTube video must have a known size.");
  if (Number(version.masterRevisionSynced || 0) !== Number(master.revision || 0))
    throw new TypeError("Master changed; update or review this YouTube draft before publishing.");
  const result = validateYouTubeVersionDraft({
    ...version, mediaIds: (version.mediaIds || []).map(String),
    videoThumbnailMediaId: String(version.videoThumbnailMediaId || ""),
    media: [{ ...video, _id: String(video._id) }],
    thumbnail: thumbnail ? { ...thumbnail, _id: String(thumbnail._id) } : null,
    healthStatus: "healthy", canPublish: true, videoDuration: video.duration,
    isShort: master.contentLength !== "long",
  });
  if (!result.publishable) throw new TypeError(result.blocking.join(" "));
  return { title: version.title, description: prepareYouTubeDescription(version.description, version.chapters).text,
    privacyStatus: version.privacyStatus, madeForKids: version.madeForKids };
}
async function persist(ctx, attempt, fields, versionFields = {}) {
  const now = new Date();
  await ctx.attempts.updateOne({ _id: attempt._id }, { $set: { ...fields, updatedAt: now } });
  if (Object.keys(versionFields).length)
    await ctx.versions.updateOne({ _id: ctx.version._id, revision: ctx.version.revision },
      { $set: { ...versionFields, lastPublishAttemptId: attempt._id, updatedAt: now } });
}
async function finish(ctx, attempt, accessToken) {
  const processing = await readYouTubeVideoProcessing({ accessToken, videoId: attempt.providerVideoId });
  await persist(ctx, attempt, { providerStatus: processing }, { providerStatus: processing });
  if (processing.uploadStatus === "failed" || processing.uploadStatus === "rejected" || processing.processingStatus === "failed") {
    await persist(ctx, attempt, { status: "failed", providerError: "YouTube reported video processing failure.", completedAt: new Date() },
      { status: "failed", lastPublishStatus: "failed", lastPublishError: "YouTube processing failed." });
  } else if (processing.processingStatus === "succeeded" || processing.uploadStatus === "processed") {
    if (ctx.thumbnail && !attempt.thumbnailApplied && !attempt.thumbnailStartedAt) {
      const claim = await ctx.attempts.updateOne({
        _id: attempt._id, thumbnailApplied: { $ne: true }, thumbnailStartedAt: { $exists: false },
      }, { $set: { thumbnailStartedAt: new Date(), thumbnailStatus: "submitting", updatedAt: new Date() } });
      if (claim.modifiedCount) {
        try {
          const media = await readMediaObject(ctx.thumbnail.objectKey);
          await setYouTubeThumbnail({ accessToken, videoId: attempt.providerVideoId,
            bytes: media.bytes, mimeType: ctx.thumbnail.contentType });
          await persist(ctx, attempt, { thumbnailApplied: true, thumbnailStatus: "applied", thumbnailError: null });
        } catch {
          await persist(ctx, attempt, { thumbnailStatus: "needs_review",
            thumbnailError: "YouTube did not confirm the custom thumbnail. Review it in YouTube Studio; do not retry automatically." });
        }
      }
    }
    await persist(ctx, attempt, { status: "succeeded", completedAt: new Date(), providerError: null },
      { status: "published", lastPublishStatus: "succeeded", lastPublishError: null,
        publishedRevision: ctx.version.revision, publishedAt: new Date(),
        providerPostId: attempt.providerVideoId, providerPostUrl: youtubeVideoUrl(attempt.providerVideoId) });
  }
  return safeOutput(await ctx.versions.findOne({ _id: ctx.version._id }),
    await ctx.attempts.findOne({ _id: attempt._id }));
}
export async function getYouTubePublishStatus(id) {
  const ctx = await load(id);
  const attempt = await ctx.attempts.findOne({
    platform: "youtube", platformVersionId: ctx.version._id,
  }, { sort: { createdAt: -1 } });
  return {
    ...safeOutput(ctx.version, attempt),
    diagnostics: summarizeYouTubeUploadDiagnostics(attempt, ctx.video),
  };
}
/**
 * One diagnostic request to the EXISTING YouTube resumable session.
 * Does not initiate an upload, transfer S3 bytes, update video metadata or resume publication.
 * Stores an allowlisted result only, leaving publish status and upload leases untouched.
 */
export async function checkYouTubeSavedUploadSession(id) {
  const ctx = await load(id);
  const attempt = await ctx.attempts.findOne({
    platform: "youtube",
    platformVersionId: ctx.version._id,
    clientId: ctx.version.clientId,
    socialConnectionId: ctx.version.socialConnectionId,
  }, { sort: { createdAt: -1 } });

  if (!attempt) throw new TypeError("No recorded YouTube upload exists for this destination.");
  if (Number(attempt.platformVersionRevision) !== Number(ctx.version.revision))
    throw new YouTubePublishConflictError(
      "Saved upload belongs to another revision. Do not start or resume an upload.", safeAttempt(attempt));
  if (attempt.mediaAssetIds?.length !== 1 ||
      String(attempt.mediaAssetIds[0]) !== String(ctx.video?._id))
    throw new YouTubePublishConflictError(
      "Selected video differs from the saved upload attempt. Inspect before proceeding.", safeAttempt(attempt));

  const size = Number(ctx.video?.size);
  let state = null;
  let error = null;
  if (!attempt.uploadSessionEncrypted) {
    error = new TypeError("No upload session is saved.");
  } else if (!Number.isSafeInteger(size) || size <= 0) {
    error = new TypeError("Original video size is unavailable.");
  } else {
    try {
      const accessToken = await credentials(ctx);
      state = await probeYouTubeResumableUpload({
        sessionUrl: decryptSecret(attempt.uploadSessionEncrypted),
        accessToken,
        size,
      });
    } catch (cause) {
      error = cause;
    }
  }

  const uploadSessionCheck = buildYouTubeSessionCheck({ state, error, size });
  // This is the only publish-attempt write: save the diagnostic without changing
  // upload status, progress, video ID, active step or updatedAt. Credentials may
  // separately refresh connection health if authorization is expiring.
  await ctx.attempts.updateOne({
    _id: attempt._id,
    platform: "youtube",
    platformVersionId: ctx.version._id,
    clientId: ctx.version.clientId,
  }, { $set: { uploadSessionCheck } });

  const saved = await ctx.attempts.findOne({ _id: attempt._id });
  return {
    ...safeOutput(ctx.version, saved),
    diagnostics: summarizeYouTubeUploadDiagnostics(saved, ctx.video),
  };
}

export async function publishYouTubeVersion(id) {
  const ctx = await load(id);
  const accessToken = await credentials(ctx);
  const metadata = await snapshot(ctx);
  await ctx.attempts.createIndex({ submissionKey: 1 }, { unique: true, sparse: true });
  const key = `youtube:${ctx.version._id}:${ctx.version.revision}`;
  const now = new Date();
  let attempt;
  try {
    const inserted = await ctx.attempts.insertOne({
      submissionKey: key, platform: "youtube", publishMode: "video",
      platformVersionId: ctx.version._id, masterContentId: ctx.version.masterContentId,
      clientId: ctx.version.clientId, socialConnectionId: ctx.version.socialConnectionId,
      platformVersionRevision: ctx.version.revision, masterRevision: ctx.master.revision,
      mediaAssetIds: ctx.version.mediaIds, videoThumbnailMediaAssetId: ctx.version.videoThumbnailMediaId || null,
      uploadSessionEncrypted: null, bytesUploaded: 0, providerVideoId: "",
      providerPostId: "", providerPostUrl: "", providerError: null, status: "submitting",
      createdAt: now, updatedAt: now, startedAt: now, completedAt: null,
    });
    attempt = await ctx.attempts.findOne({ _id: inserted.insertedId });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const previous = await ctx.attempts.findOne({ submissionKey: key });
    throw new YouTubePublishConflictError("This YouTube revision has an existing upload. Resume or inspect it instead of starting a duplicate.",
      safeAttempt(previous));
  }
  // A session POST could succeed even when a network response is lost. Never retry it automatically.
  let session;
  try {
    session = await startYouTubeResumableUpload({ accessToken, ...metadata, size: Number(ctx.video.size),
      mimeType: ctx.video.contentType });
  } catch (error) {
    await persist(ctx, attempt, { status: "needs_review", providerError: "Upload session creation is uncertain." },
      { status: "needs_review", lastPublishStatus: "needs_review" });
    throw new YouTubePublishProviderError(error.message, safeAttempt(await ctx.attempts.findOne({ _id: attempt._id })));
  }
  await persist(ctx, attempt, { uploadSessionEncrypted: encryptSecret(session), status: "uploading" },
    { status: "processing", lastPublishStatus: "processing" });
  return resumeYouTubeVersion(id);
}
export async function resumeYouTubeVersion(id) {
  const ctx = await load(id);
  const key = `youtube:${ctx.version._id}:${ctx.version.revision}`;
  const attempt = await ctx.attempts.findOne({ submissionKey: key });
  if (!attempt) throw new TypeError("No saved YouTube upload exists.");
  if (["succeeded", "failed", "needs_review"].includes(attempt.status))
    return safeOutput(ctx.version, attempt);
  const accessToken = await credentials(ctx);
  if (attempt.providerVideoId) {
    try {
      return await finish(ctx, attempt, accessToken);
    } catch (error) {
      await persist(ctx, attempt, { providerError: "YouTube processing status could not be completed: " + String(error?.message || "Unknown error").slice(0, 250) });
      throw error;
    }
  }
  // Claim one bounded upload-step lease. A stranded claim remains blocked for deliberate review,
  // avoiding concurrent duplicate ranges or unsafe automatic replay.
  const claim = await ctx.attempts.updateOne({
    _id: attempt._id, $or: [
      { uploadStepStartedAt: { $exists: false } },
      { uploadStepStartedAt: { $lt: new Date(Date.now() - 3 * 60 * 1000) } },
    ],
  }, { $set: { uploadStepStartedAt: new Date() } });
  if (!claim.modifiedCount) throw new YouTubePublishConflictError(
    "A YouTube upload step is already running or needs review before retry.", safeAttempt(attempt));
  if (!attempt.uploadSessionEncrypted)
    throw new YouTubePublishConflictError("Upload session was not saved; manual review required.", safeAttempt(attempt));
  const size = Number(ctx.video?.size);
  if (!Number.isSafeInteger(size) || size <= 0) throw new TypeError("Selected video no longer exists.");
  let state;
  try {
    state = await probeYouTubeResumableUpload({ sessionUrl: decryptSecret(attempt.uploadSessionEncrypted), accessToken, size });
  } catch (error) {
    await persist(ctx, attempt, { providerError: "YouTube upload session check failed: " + String(error?.message || "Unknown error").slice(0, 250) });
    throw new YouTubePublishProviderError(error.message, safeAttempt(await ctx.attempts.findOne({ _id: attempt._id })));
  }
  if (!state.completed) {
    const offset = state.offset;
    if (offset < size) {
      const end = nextYouTubeChunkEnd(offset, size);
      try {
        const object = await readMediaObjectRange(ctx.video.objectKey, offset, end);
        state = await sendYouTubeUploadChunk({
          sessionUrl: decryptSecret(attempt.uploadSessionEncrypted), accessToken,
          mimeType: ctx.video.contentType, size, offset, bytes: object.bytes,
        });
      } catch (error) {
        // Keep the same session, record the failure and require a probe before any retry.
        await persist(ctx, attempt, { providerError: "YouTube media transfer failed: " + String(error?.message || "Unknown error").slice(0, 250) });
        throw new YouTubePublishProviderError(error.message, safeAttempt(await ctx.attempts.findOne({ _id: attempt._id })));
      }
      if (!state.completed) {
        await ctx.attempts.updateOne({ _id: attempt._id }, { $unset: { uploadStepStartedAt: "" } });
        await persist(ctx, attempt, { bytesUploaded: state.offset, status: "uploading" });
        return safeOutput(await ctx.versions.findOne({ _id: ctx.version._id }),
          await ctx.attempts.findOne({ _id: attempt._id }));
      }
    }
  }
  if (!state.completed) throw new YouTubePublishConflictError("Upload response is not final; probe saved session.", safeAttempt(attempt));
  const videoId = state.completed.videoId;
  await ctx.attempts.updateOne({ _id: attempt._id }, { $unset: { uploadStepStartedAt: "" } });
  await persist(ctx, attempt, { providerVideoId: videoId, providerPostId: videoId,
    providerPostUrl: youtubeVideoUrl(videoId), providerStatus: state.completed.providerStatus,
    status: "processing", bytesUploaded: size },
  { providerVideoId: videoId, providerPostId: videoId,
    providerPostUrl: youtubeVideoUrl(videoId), status: "processing", lastPublishStatus: "processing" });
  return safeOutput(await ctx.versions.findOne({ _id: ctx.version._id }),
    await ctx.attempts.findOne({ _id: attempt._id }));
}
