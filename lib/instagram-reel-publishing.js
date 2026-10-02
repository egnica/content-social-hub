import "server-only";

import { refreshSocialConnectionHealth } from "@/lib/connections";
import {
  createInstagramReelContainer,
  getInstagramContainerStatus,
  getInstagramPublishedMedia,
  publishInstagramContainer,
} from "@/lib/instagram-publisher";
import {
  createInstagramSubmissionKey,
  isDefinitiveInstagramProviderFailure,
  sanitizeInstagramProviderError,
} from "@/lib/instagram-publish-logic";
import {
  resolveInstagramReelCoverMediaId,
  validateInstagramReelPublishDraft,
} from "@/lib/instagram-reel-publish-logic";
import { ensureInstagramImageAsset } from "@/lib/instagram-image-derivatives";
import {
  InstagramPublishConflictError,
  InstagramPublishProviderError,
} from "@/lib/instagram-publishing";
import {
  instagramCarouselMediaView,
  loadInstagramCarouselPublishContext,
} from "@/lib/instagram-carousel-publish-state";
import { serializeDocument } from "@/lib/ids";
import { decryptSecret } from "@/lib/secure-values";
import { createMediaViewUrl } from "@/lib/s3";

function providerProcessingError(name, message) {
  return {
    name,
    message,
    code: null,
    type: "",
    errorSubcode: null,
    isTransient: false,
    userTitle: "",
    userMessage: "",
    traceId: "",
  };
}

function serializeBundle(platformVersion, attempt) {
  return serializeDocument({ platformVersion, attempt });
}

async function resolveReelCoverAsset(context) {
  const coverMediaId = resolveInstagramReelCoverMediaId({
    versionCoverMediaId: context.version.videoThumbnailMediaId,
    masterCoverMediaId: context.master.defaultVideoThumbnailMediaId,
    versionMasterRevision: context.version.masterRevisionSynced,
    masterRevision: context.master.revision,
  });

  if (!coverMediaId) return null;

  const coverAsset = await context.media.findOne({
    _id:
      context.version.videoThumbnailMediaId ||
      context.master.defaultVideoThumbnailMediaId,
    clientId: context.version.clientId,
    status: "uploaded",
    contentType: /^image\//,
  });

  if (!coverAsset) {
    throw new TypeError(
      "The Master video thumbnail selected for this Instagram Reel is no longer available. Update the Instagram version from Master before publishing.",
    );
  }

  return coverAsset;
}

async function tryResolvePermalink(providerPostId, accessToken) {
  for (let index = 0; index < 3; index += 1) {
    try {
      const result = await getInstagramPublishedMedia({
        providerPostId,
        accessToken,
      });
      if (result.providerPostUrl) return result;
    } catch {
      // Publishing already succeeded. Permalink lookup is safe to retry without
      // creating another Reel.
    }

    if (index < 2) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return { providerPostId, providerPostUrl: "", providerMediaType: null };
}

async function createReelAttempt(context, submissionKey, coverAsset = null) {
  const { publishAttempts, selectedMediaIds, version } = context;
  const now = new Date();
  const document = {
    platformVersionId: version._id,
    masterContentId: version.masterContentId,
    masterRevision: Number(version.masterRevisionSynced || 1),
    platformVersionRevision: Number(version.revision || 1),
    clientId: version.clientId,
    socialConnectionId: version.socialConnectionId,
    platform: "instagram",
    publishMode: "reel",
    mediaAssetIds: selectedMediaIds,
    coverMediaAssetId: coverAsset?._id || null,
    providerCoverObjectKey: coverAsset?.objectKey || "",
    providerMedia: [],
    providerStage: "container",
    providerContainerId: "",
    providerStatus: null,
    submissionKey,
    status: "submitting",
    startedAt: now,
    completedAt: null,
    providerPostId: "",
    providerPostUrl: "",
    providerError: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await publishAttempts.insertOne(document);
    return publishAttempts.findOne({ _id: result.insertedId });
  } catch (error) {
    if (error?.code !== 11000) throw error;

    const existing = await publishAttempts.findOne({ submissionKey });
    const message =
      existing?.status === "succeeded"
        ? "This exact Instagram Reel revision has already been published."
        : ["submitting", "processing"].includes(existing?.status)
          ? "This Instagram Reel has already been submitted and is still in progress."
          : "A Reel publish for this exact Instagram version revision is already in progress or requires review.";

    throw new InstagramPublishConflictError(
      message,
      existing ? serializeDocument(existing) : null,
    );
  }
}

async function setReelVersionProcessing({ context, attemptId, providerContainerId }) {
  const now = new Date();
  const updatedVersion = await context.platformVersions.findOneAndUpdate(
    { _id: context.version._id, revision: context.version.revision },
    {
      $set: {
        status: "processing",
        lastPublishAttemptId: attemptId,
        lastPublishStatus: "processing",
        lastPublishError: null,
        providerContainerId,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!updatedVersion) {
    throw new InstagramPublishConflictError(
      "Instagram accepted the Reel container, but the saved version changed before processing state could be recorded. Do not create another Reel for this recorded attempt.",
      serializeDocument(await context.publishAttempts.findOne({ _id: attemptId })),
    );
  }

  return updatedVersion;
}

async function markReelRetrySafeFailure({ context, attemptId, providerError }) {
  const completedAt = new Date();

  await context.publishAttempts.updateOne(
    { _id: attemptId },
    {
      $set: {
        status: "failed",
        providerError,
        completedAt,
        updatedAt: completedAt,
      },
      $unset: { submissionKey: "" },
    },
  );

  await context.platformVersions.updateOne(
    { _id: context.version._id, revision: context.version.revision },
    {
      $set: {
        status: "failed",
        lastPublishAttemptId: attemptId,
        lastPublishStatus: "failed",
        lastPublishError: providerError,
        updatedAt: completedAt,
      },
    },
  );
}

async function markReelUnknown({ context, attemptId, providerError }) {
  const completedAt = new Date();

  await context.publishAttempts.updateOne(
    { _id: attemptId },
    {
      $set: {
        status: "unknown",
        providerStage: "publish",
        providerError,
        completedAt,
        updatedAt: completedAt,
      },
    },
  );

  await context.platformVersions.updateOne(
    { _id: context.version._id, revision: context.version.revision },
    {
      $set: {
        lastPublishAttemptId: attemptId,
        lastPublishStatus: "unknown",
        lastPublishError: providerError,
        updatedAt: completedAt,
      },
    },
  );
}

async function claimReelPublish({ context, attempt }) {
  const claimedAt = new Date();
  const claimed = await context.publishAttempts.findOneAndUpdate(
    {
      _id: attempt._id,
      status: "processing",
      providerStage: "container",
      providerContainerId: attempt.providerContainerId,
    },
    {
      $set: {
        status: "submitting",
        providerStage: "publish",
        updatedAt: claimedAt,
      },
    },
    { returnDocument: "after" },
  );

  if (!claimed) {
    throw new InstagramPublishConflictError(
      "This Instagram Reel container is already being published or requires review. Do not submit it again.",
      serializeDocument(
        await context.publishAttempts.findOne({ _id: attempt._id }),
      ),
    );
  }

  const versionResult = await context.platformVersions.updateOne(
    { _id: context.version._id, revision: context.version.revision },
    {
      $set: {
        lastPublishAttemptId: attempt._id,
        lastPublishStatus: "submitting",
        updatedAt: claimedAt,
      },
    },
  );

  if (versionResult.matchedCount !== 1) {
    const providerError = providerProcessingError(
      "InstagramReelRevisionConflict",
      "The saved Instagram version changed before the Reel container could be published.",
    );
    const completedAt = new Date();
    await context.publishAttempts.updateOne(
      { _id: claimed._id, status: "submitting", providerStage: "publish" },
      {
        $set: {
          status: "failed",
          providerError,
          completedAt,
          updatedAt: completedAt,
        },
        $unset: { submissionKey: "" },
      },
    );

    throw new InstagramPublishConflictError(
      `${providerError.message} No Instagram Reel was published by this attempt.`,
      serializeDocument(
        await context.publishAttempts.findOne({ _id: claimed._id }),
      ),
    );
  }

  return claimed;
}

async function finalizeReelSuccess({
  context,
  attemptId,
  providerContainerId,
  providerPostId,
  providerPostUrl,
  providerStatus = null,
}) {
  const completedAt = new Date();

  await context.publishAttempts.updateOne(
    { _id: attemptId },
    {
      $set: {
        status: "succeeded",
        providerStage: "published",
        providerContainerId,
        providerPostId,
        providerPostUrl,
        providerStatus,
        providerError: null,
        completedAt,
        updatedAt: completedAt,
      },
    },
  );

  const updatedVersion = await context.platformVersions.findOneAndUpdate(
    { _id: context.version._id, revision: context.version.revision },
    {
      $set: {
        status: "published",
        publishedAt: completedAt,
        publishedRevision: Number(context.version.revision || 1),
        lastPublishAttemptId: attemptId,
        lastPublishStatus: "succeeded",
        lastPublishError: null,
        providerContainerId,
        providerMediaIds: [providerPostId],
        providerPostId,
        providerPostUrl,
        updatedAt: completedAt,
      },
    },
    { returnDocument: "after" },
  );

  if (!updatedVersion) {
    throw new InstagramPublishConflictError(
      "Instagram published the Reel, but the saved version changed before the local result could be finalized. Do not publish again until the recorded attempt is reviewed.",
      serializeDocument(await context.publishAttempts.findOne({ _id: attemptId })),
    );
  }

  return serializeBundle(
    updatedVersion,
    await context.publishAttempts.findOne({ _id: attemptId }),
  );
}

async function publishReadyReel({
  context,
  attempt,
  accessToken,
  providerStatus = null,
}) {
  const claimed = await claimReelPublish({ context, attempt });
  let published;

  try {
    published = await publishInstagramContainer({
      accountId: context.connection.providerAccountId,
      accessToken,
      providerContainerId: claimed.providerContainerId,
    });
  } catch (error) {
    const providerError = sanitizeInstagramProviderError(error);
    await markReelUnknown({
      context,
      attemptId: claimed._id,
      providerError,
    });

    throw new InstagramPublishProviderError(
      "Instagram Reel publish result is uncertain. Do not publish this version again until the recorded attempt is reviewed.",
      serializeDocument(
        await context.publishAttempts.findOne({ _id: claimed._id }),
      ),
    );
  }

  const remote = await tryResolvePermalink(
    published.providerPostId,
    accessToken,
  );

  return finalizeReelSuccess({
    context,
    attemptId: claimed._id,
    providerContainerId: claimed.providerContainerId,
    providerPostId: published.providerPostId,
    providerPostUrl: remote.providerPostUrl,
    providerStatus,
  });
}

async function checkContainerUntilReady({
  providerContainerId,
  accessToken,
  attempts = 4,
}) {
  let result = null;

  for (let index = 0; index < attempts; index += 1) {
    result = await getInstagramContainerStatus({
      providerContainerId,
      accessToken,
    });

    if (result.processingState !== "processing") return result;
    if (index < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }

  return result;
}

async function processRecordedReel({
  context,
  attempt,
  accessToken,
  poll = false,
}) {
  let statusResult;

  try {
    statusResult = await checkContainerUntilReady({
      providerContainerId: attempt.providerContainerId,
      accessToken,
      attempts: poll ? 4 : 1,
    });
  } catch (error) {
    throw new InstagramPublishProviderError(
      "Unable to refresh Instagram Reel processing status. The recorded Reel container is preserved; check the same attempt again rather than republishing.",
      {
        ...serializeDocument(attempt),
        providerError: sanitizeInstagramProviderError(error),
      },
    );
  }

  await context.publishAttempts.updateOne(
    { _id: attempt._id },
    {
      $set: {
        providerStatus: statusResult.providerStatus,
        updatedAt: new Date(),
      },
    },
  );

  if (statusResult.processingState === "failed") {
    const providerError = providerProcessingError(
      "InstagramReelProcessingError",
      "Instagram reported that the Reel container failed processing.",
    );
    await markReelRetrySafeFailure({
      context,
      attemptId: attempt._id,
      providerError,
    });

    return serializeBundle(
      await context.platformVersions.findOne({ _id: context.version._id }),
      await context.publishAttempts.findOne({ _id: attempt._id }),
    );
  }

  if (statusResult.processingState !== "finished") {
    const updatedVersion = await setReelVersionProcessing({
      context,
      attemptId: attempt._id,
      providerContainerId: attempt.providerContainerId,
    });
    return serializeBundle(
      updatedVersion,
      await context.publishAttempts.findOne({ _id: attempt._id }),
    );
  }

  return publishReadyReel({
    context,
    attempt: await context.publishAttempts.findOne({ _id: attempt._id }),
    accessToken,
    providerStatus: statusResult.providerStatus,
  });
}

function validateContext(context, refreshedConnection) {
  const validation = validateInstagramReelPublishDraft({
    caption: context.version.caption,
    mediaIds: context.selectedMediaIds.map((id) => id.toString()),
    mediaAssets: context.orderedMedia.map(instagramCarouselMediaView),
    healthStatus: refreshedConnection.healthStatus,
    canPublish: refreshedConnection.capabilities?.canPublish === true,
  });

  if (!validation.publishable) {
    throw new TypeError(validation.blocking.join(" "));
  }
}

export async function publishInstagramReelVersion(versionId) {
  const context = await loadInstagramCarouselPublishContext(versionId);
  const refreshedConnection = await refreshSocialConnectionHealth(
    context.connection._id.toString(),
  );

  if (!refreshedConnection) {
    throw new TypeError("The Instagram destination is no longer available.");
  }

  context.connection = await context.connections.findOne({
    _id: context.connection._id,
    clientId: context.version.clientId,
    platform: "instagram",
    providerAccountId: context.connection.providerAccountId,
  });
  if (!context.connection)
    throw new TypeError("The Instagram destination changed during preflight.");
  validateContext(context, context.connection);

  const coverAsset = await resolveReelCoverAsset(context);
  const providerCoverAsset = coverAsset
    ? await ensureInstagramImageAsset(coverAsset)
    : null;
  const submissionKey = createInstagramSubmissionKey(
    context.version._id.toString(),
    Number(context.version.revision || 1),
  );
  let attempt = await createReelAttempt(
    context,
    submissionKey,
    providerCoverAsset,
  );
  const accessToken = decryptSecret(context.connection.tokenEncrypted);
  const asset = context.orderedMedia[0];
  let providerContainerId = "";

  try {
    const [videoUrl, coverUrl] = await Promise.all([
      createMediaViewUrl(asset.objectKey),
      providerCoverAsset?.objectKey
        ? createMediaViewUrl(providerCoverAsset.objectKey)
        : Promise.resolve(""),
    ]);
    const created = await createInstagramReelContainer({
      accountId: context.connection.providerAccountId,
      accessToken,
      videoUrl,
      coverUrl,
      caption: context.version.caption || "",
    });
    providerContainerId = created.providerContainerId;
    const providerMedia = [
      {
        mediaAssetId: asset._id,
        providerContainerId,
        contentType: asset.contentType || "",
        providerObjectKey: asset.objectKey,
        providerStatus: null,
        processingState: "processing",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await context.publishAttempts.updateOne(
      { _id: attempt._id, status: "submitting" },
      {
        $set: {
          providerMedia,
          status: "processing",
          providerStage: "container",
          providerContainerId,
          updatedAt: new Date(),
        },
      },
    );

    await setReelVersionProcessing({
      context,
      attemptId: attempt._id,
      providerContainerId,
    });

    attempt = await context.publishAttempts.findOne({ _id: attempt._id });
    return await processRecordedReel({
      context,
      attempt,
      accessToken,
      poll: true,
    });
  } catch (error) {
    if (
      error instanceof InstagramPublishConflictError ||
      error instanceof InstagramPublishProviderError
    ) {
      throw error;
    }

    const providerError = sanitizeInstagramProviderError(error);
    const definitiveFailure =
      isDefinitiveInstagramProviderFailure(error) && !providerContainerId;

    if (definitiveFailure) {
      await markReelRetrySafeFailure({
        context,
        attemptId: attempt._id,
        providerError,
      });
      throw new InstagramPublishProviderError(
        providerError.message || "Instagram rejected the Reel container request.",
        serializeDocument(
          await context.publishAttempts.findOne({ _id: attempt._id }),
        ),
      );
    }

    await markReelUnknown({
      context,
      attemptId: attempt._id,
      providerError,
    });
    throw new InstagramPublishProviderError(
      providerContainerId
        ? "Instagram Reel state became uncertain after a container was recorded. Do not create another Reel until the recorded attempt is reviewed."
        : "Instagram Reel container creation is uncertain. Do not submit this revision again until the recorded attempt is reviewed.",
      serializeDocument(
        await context.publishAttempts.findOne({ _id: attempt._id }),
      ),
    );
  }
}

export async function checkInstagramReelPublishStatus(versionId) {
  const context = await loadInstagramCarouselPublishContext(versionId);
  const attemptId = context.version.lastPublishAttemptId;

  if (!attemptId) {
    throw new TypeError("No Instagram Reel publish attempt is available to check.");
  }

  const attempt = await context.publishAttempts.findOne({
    _id: attemptId,
    platformVersionId: context.version._id,
    platformVersionRevision: Number(context.version.revision || 1),
    publishMode: "reel",
  });

  if (!attempt) {
    throw new TypeError("No Instagram Reel publish attempt is available to check.");
  }

  const accessToken = decryptSecret(context.connection.tokenEncrypted);

  if (attempt.status === "succeeded") {
    if (!attempt.providerPostUrl && attempt.providerPostId) {
      const remote = await tryResolvePermalink(
        attempt.providerPostId,
        accessToken,
      );
      if (remote.providerPostUrl) {
        await Promise.all([
          context.publishAttempts.updateOne(
            { _id: attempt._id },
            {
              $set: {
                providerPostUrl: remote.providerPostUrl,
                updatedAt: new Date(),
              },
            },
          ),
          context.platformVersions.updateOne(
            { _id: context.version._id },
            {
              $set: {
                providerPostUrl: remote.providerPostUrl,
                updatedAt: new Date(),
              },
            },
          ),
        ]);
      }
    }

    return serializeBundle(
      await context.platformVersions.findOne({ _id: context.version._id }),
      await context.publishAttempts.findOne({ _id: attempt._id }),
    );
  }

  if (attempt.status === "submitting" && attempt.providerStage === "publish") {
    throw new InstagramPublishConflictError(
      "This Reel container has already entered the final Instagram publish step. Do not submit it again while the recorded result is unresolved.",
      serializeDocument(attempt),
    );
  }

  if (attempt.status !== "processing" || !attempt.providerContainerId) {
    throw new TypeError(
      "This Instagram Reel attempt is not currently waiting for provider processing.",
    );
  }

  return processRecordedReel({
    context,
    attempt,
    accessToken,
    poll: false,
  });
}
