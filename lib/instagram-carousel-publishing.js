import "server-only";

import { refreshSocialConnectionHealth } from "@/lib/connections";
import { ensureInstagramImageAsset } from "@/lib/instagram-image-derivatives";
import {
  createInstagramCarouselContainer,
  createInstagramImageContainer,
  createInstagramVideoContainer,
  getInstagramContainerStatus,
  getInstagramPublishedMedia,
  publishInstagramContainer,
} from "@/lib/instagram-publisher";
import {
  createInstagramSubmissionKey,
  sanitizeInstagramProviderError,
} from "@/lib/instagram-publish-logic";
import {
  isInstagramCarouselItemVideo,
  validateInstagramCarouselPublishDraft,
} from "@/lib/instagram-carousel-publish-logic";
import {
  InstagramPublishConflictError,
  InstagramPublishProviderError,
} from "@/lib/instagram-publishing";
import {
  claimCarouselParentPublish,
  createCarouselPublishAttempt,
  finalizeCarouselSuccess,
  instagramCarouselMediaView,
  loadInstagramCarouselPublishContext,
  markCarouselRetrySafeFailure,
  markCarouselUnknown,
  serializeCarouselBundle,
  setCarouselVersionProcessing,
} from "@/lib/instagram-carousel-publish-state";
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

async function tryResolvePermalink(providerPostId, accessToken) {
  for (let index = 0; index < 3; index += 1) {
    try {
      const result = await getInstagramPublishedMedia({
        providerPostId,
        accessToken,
      });
      if (result.providerPostUrl) return result;
    } catch {
      // The carousel is already live. Permalink lookup can safely be retried.
    }

    if (index < 2) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return { providerPostId, providerPostUrl: "", providerMediaType: null };
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

async function checkChildContainers(providerMedia, accessToken) {
  const nextItems = [];
  let failedItem = null;
  let anyProcessing = false;

  for (const item of providerMedia || []) {
    const result = await getInstagramContainerStatus({
      providerContainerId: item.providerContainerId,
      accessToken,
    });
    const next = {
      ...item,
      providerStatus: result.providerStatus,
      processingState: result.processingState,
      updatedAt: new Date(),
    };
    nextItems.push(next);

    if (result.processingState === "failed" && !failedItem) {
      failedItem = next;
    }
    if (result.processingState === "processing") {
      anyProcessing = true;
    }
  }

  return { providerMedia: nextItems, failedItem, anyProcessing };
}

async function createCarouselChildren(context, attempt, accessToken) {
  const providerMedia = [];

  for (const asset of context.orderedMedia) {
    const isVideo = isInstagramCarouselItemVideo(asset);
    const providerAsset = isVideo
      ? asset
      : await ensureInstagramImageAsset(asset);
    const mediaUrl = await createMediaViewUrl(providerAsset.objectKey);
    const created = isVideo
      ? await createInstagramVideoContainer({
          accountId: context.connection.providerAccountId,
          accessToken,
          videoUrl: mediaUrl,
          isCarouselItem: true,
        })
      : await createInstagramImageContainer({
          accountId: context.connection.providerAccountId,
          accessToken,
          imageUrl: mediaUrl,
          isCarouselItem: true,
        });

    providerMedia.push({
      mediaAssetId: asset._id,
      providerContainerId: created.providerContainerId,
      contentType: providerAsset.contentType || "",
      providerObjectKey: providerAsset.objectKey,
      instagramDerivative: providerAsset.instagramDerivative === true,
      providerStatus: null,
      processingState: "processing",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await context.publishAttempts.updateOne(
      { _id: attempt._id },
      {
        $set: {
          providerMedia,
          status: "processing",
          providerStage: "children",
          updatedAt: new Date(),
        },
      },
    );
  }

  return context.publishAttempts.findOne({ _id: attempt._id });
}

async function createCarouselParent(context, attempt, accessToken) {
  const childContainerIds = (attempt.providerMedia || []).map(
    (item) => item.providerContainerId,
  );
  const created = await createInstagramCarouselContainer({
    accountId: context.connection.providerAccountId,
    accessToken,
    childContainerIds,
    caption: context.version.caption || "",
  });

  await context.publishAttempts.updateOne(
    { _id: attempt._id },
    {
      $set: {
        status: "processing",
        providerStage: "parent",
        providerContainerId: created.providerContainerId,
        updatedAt: new Date(),
      },
    },
  );

  await setCarouselVersionProcessing({
    context,
    attemptId: attempt._id,
    providerContainerId: created.providerContainerId,
  });

  return context.publishAttempts.findOne({ _id: attempt._id });
}

async function publishReadyCarouselParent({
  context,
  attempt,
  accessToken,
  providerStatus = null,
}) {
  const claimed = await claimCarouselParentPublish({ context, attempt });
  let published;

  try {
    published = await publishInstagramContainer({
      accountId: context.connection.providerAccountId,
      accessToken,
      providerContainerId: claimed.providerContainerId,
    });
  } catch (error) {
    const providerError = sanitizeInstagramProviderError(error);
    await markCarouselUnknown({
      context,
      attemptId: claimed._id,
      providerError,
    });

    throw new InstagramPublishProviderError(
      "Instagram carousel publish result is uncertain. Do not publish this version again until the recorded attempt is reviewed.",
      await context.publishAttempts.findOne({ _id: claimed._id }),
    );
  }

  const remote = await tryResolvePermalink(
    published.providerPostId,
    accessToken,
  );

  return finalizeCarouselSuccess({
    context,
    attemptId: claimed._id,
    providerContainerId: claimed.providerContainerId,
    providerPostId: published.providerPostId,
    providerPostUrl: remote.providerPostUrl,
    providerStatus,
  });
}

async function failKnownPreparation({
  context,
  attemptId,
  name,
  message,
  throwError,
}) {
  const providerError = providerProcessingError(name, message);
  await markCarouselRetrySafeFailure({
    context,
    attemptId,
    providerError,
  });
  const attempt = await context.publishAttempts.findOne({ _id: attemptId });

  if (throwError) {
    throw new InstagramPublishProviderError(message, attempt);
  }

  return serializeCarouselBundle(
    context,
    await context.platformVersions.findOne({ _id: context.version._id }),
    attempt,
  );
}

async function continueCarouselAttempt({
  context,
  attempt,
  accessToken,
  throwOnKnownFailure = false,
  pollParent = false,
}) {
  if (!attempt.providerContainerId) {
    const childCheck = await checkChildContainers(
      attempt.providerMedia,
      accessToken,
    );

    await context.publishAttempts.updateOne(
      { _id: attempt._id },
      {
        $set: {
          providerMedia: childCheck.providerMedia,
          status: "processing",
          providerStage: "children",
          updatedAt: new Date(),
        },
      },
    );

    if (childCheck.failedItem) {
      return failKnownPreparation({
        context,
        attemptId: attempt._id,
        name: "InstagramCarouselChildProcessingError",
        message:
          "Instagram reported that a carousel child container failed processing.",
        throwError: throwOnKnownFailure,
      });
    }

    if (childCheck.anyProcessing) {
      const updatedVersion = await setCarouselVersionProcessing({
        context,
        attemptId: attempt._id,
      });
      return serializeCarouselBundle(
        context,
        updatedVersion,
        await context.publishAttempts.findOne({ _id: attempt._id }),
      );
    }

    attempt = await createCarouselParent(context, attempt, accessToken);
  }

  const parentStatus = await checkContainerUntilReady({
    providerContainerId: attempt.providerContainerId,
    accessToken,
    attempts: pollParent ? 4 : 1,
  });

  await context.publishAttempts.updateOne(
    { _id: attempt._id },
    {
      $set: {
        providerStatus: parentStatus.providerStatus,
        status: "processing",
        providerStage: "parent",
        updatedAt: new Date(),
      },
    },
  );

  if (parentStatus.processingState === "failed") {
    return failKnownPreparation({
      context,
      attemptId: attempt._id,
      name: "InstagramCarouselParentProcessingError",
      message: "Instagram reported that the carousel container failed processing.",
      throwError: throwOnKnownFailure,
    });
  }

  if (parentStatus.processingState !== "finished") {
    const updatedVersion = await setCarouselVersionProcessing({
      context,
      attemptId: attempt._id,
      providerContainerId: attempt.providerContainerId,
    });
    return serializeCarouselBundle(
      context,
      updatedVersion,
      await context.publishAttempts.findOne({ _id: attempt._id }),
    );
  }

  return publishReadyCarouselParent({
    context,
    attempt: await context.publishAttempts.findOne({ _id: attempt._id }),
    accessToken,
    providerStatus: parentStatus.providerStatus,
  });
}

function validateContext(context, refreshedConnection) {
  const validation = validateInstagramCarouselPublishDraft({
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

export async function publishInstagramCarouselVersion(versionId) {
  const context = await loadInstagramCarouselPublishContext(versionId);
  const refreshedConnection = await refreshSocialConnectionHealth(
    context.connection._id.toString(),
  );
  if (!refreshedConnection) {
    throw new TypeError("The Instagram destination is no longer available.");
  }
  validateContext(context, refreshedConnection);

  const submissionKey = createInstagramSubmissionKey(
    context.version._id.toString(),
    Number(context.version.revision || 1),
  );
  let attempt = await createCarouselPublishAttempt({ context, submissionKey });
  const accessToken = decryptSecret(context.connection.tokenEncrypted);

  try {
    attempt = await createCarouselChildren(context, attempt, accessToken);
    return await continueCarouselAttempt({
      context,
      attempt,
      accessToken,
      throwOnKnownFailure: true,
      pollParent: true,
    });
  } catch (error) {
    if (
      error instanceof InstagramPublishConflictError ||
      error instanceof InstagramPublishProviderError
    ) {
      throw error;
    }

    const providerError = sanitizeInstagramProviderError(error);
    await markCarouselRetrySafeFailure({
      context,
      attemptId: attempt._id,
      providerError,
    });
    throw new InstagramPublishProviderError(
      providerError.message ||
        "Instagram carousel preparation failed before publishing.",
      await context.publishAttempts.findOne({ _id: attempt._id }),
    );
  }
}

export async function checkInstagramCarouselPublishStatus(versionId) {
  const context = await loadInstagramCarouselPublishContext(versionId);
  const attemptId = context.version.lastPublishAttemptId;
  if (!attemptId) {
    throw new TypeError("No Instagram carousel publish attempt is available to check.");
  }

  let attempt = await context.publishAttempts.findOne({
    _id: attemptId,
    platformVersionId: context.version._id,
    platformVersionRevision: Number(context.version.revision || 1),
    publishMode: "carousel",
  });
  if (!attempt) {
    throw new TypeError("No Instagram carousel publish attempt is available to check.");
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

    return serializeCarouselBundle(
      context,
      await context.platformVersions.findOne({ _id: context.version._id }),
      await context.publishAttempts.findOne({ _id: attempt._id }),
    );
  }

  if (attempt.status === "submitting" && attempt.providerStage === "publish") {
    throw new InstagramPublishConflictError(
      "This carousel parent has already entered the final Instagram publish step. Do not submit it again while the recorded result is unresolved.",
      attempt,
    );
  }

  if (attempt.status !== "processing") {
    throw new TypeError(
      "This Instagram carousel attempt is not currently waiting for provider processing.",
    );
  }

  if (
    !Array.isArray(attempt.providerMedia) ||
    attempt.providerMedia.length !== context.selectedMediaIds.length
  ) {
    return failKnownPreparation({
      context,
      attemptId: attempt._id,
      name: "InstagramCarouselStateError",
      message: "The recorded carousel child-container set is incomplete.",
      throwError: false,
    });
  }

  try {
    return await continueCarouselAttempt({
      context,
      attempt,
      accessToken,
      throwOnKnownFailure: false,
      pollParent: false,
    });
  } catch (error) {
    if (
      error instanceof InstagramPublishConflictError ||
      error instanceof InstagramPublishProviderError
    ) {
      throw error;
    }

    const providerError = sanitizeInstagramProviderError(error);
    await markCarouselRetrySafeFailure({
      context,
      attemptId: attempt._id,
      providerError,
    });
    throw new InstagramPublishProviderError(
      providerError.message ||
        "Instagram carousel preparation failed before the final publish step. Retry is safe.",
      await context.publishAttempts.findOne({ _id: attempt._id }),
    );
  }
}
