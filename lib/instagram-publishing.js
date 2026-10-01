import "server-only";

import { refreshSocialConnectionHealth } from "@/lib/connections";
import { ensureInstagramImageAsset } from "@/lib/instagram-image-derivatives";
import {
  createInstagramImageContainer,
  getInstagramContainerStatus,
  getInstagramPublishedMedia,
  publishInstagramContainer,
} from "@/lib/instagram-publisher";
import {
  createInstagramSubmissionKey,
  isDefinitiveInstagramProviderFailure,
  sanitizeInstagramProviderError,
  validateInstagramSingleImagePublishDraft,
} from "@/lib/instagram-publish-logic";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import { decryptSecret } from "@/lib/secure-values";
import { createMediaViewUrl } from "@/lib/s3";

let publishIndexesPromise;

async function publishingCollections() {
  const db = await getDb();

  if (!publishIndexesPromise) {
    publishIndexesPromise = Promise.all([
      db.collection("publish_attempts").createIndex(
        { submissionKey: 1 },
        { unique: true, sparse: true },
      ),
      db.collection("publish_attempts").createIndex({
        platformVersionId: 1,
        createdAt: -1,
      }),
      db.collection("publish_attempts").createIndex({
        masterContentId: 1,
        createdAt: -1,
      }),
    ]).catch((error) => {
      publishIndexesPromise = undefined;
      throw error;
    });
  }

  await publishIndexesPromise;

  return {
    content: db.collection("master_content"),
    connections: db.collection("social_connections"),
    media: db.collection("media_assets"),
    platformVersions: db.collection("platform_versions"),
    publishAttempts: db.collection("publish_attempts"),
  };
}

export class InstagramPublishConflictError extends Error {
  constructor(message, attempt = null) {
    super(message);
    this.name = "InstagramPublishConflictError";
    this.attempt = attempt;
  }
}

export class InstagramPublishProviderError extends Error {
  constructor(message, attempt = null) {
    super(message);
    this.name = "InstagramPublishProviderError";
    this.attempt = attempt;
  }
}

function sameId(left, right) {
  return String(left || "") === String(right || "");
}

function mediaView(asset) {
  return {
    _id: asset._id.toString(),
    contentType: asset.contentType || "",
    size: Number(asset.size || 0),
    width: Number(asset.width || 0),
    height: Number(asset.height || 0),
    aspectRatio: Number(asset.aspectRatio || 0),
    originalName: asset.originalName || "",
  };
}

async function loadInstagramPublishContext(versionId) {
  const platformVersionId = toObjectId(versionId);

  if (!platformVersionId) {
    throw new TypeError("Instagram version not found.");
  }

  const {
    content,
    connections,
    media,
    platformVersions,
    publishAttempts,
  } = await publishingCollections();
  const version = await platformVersions.findOne({
    _id: platformVersionId,
    platform: "instagram",
    active: { $ne: false },
  });

  if (!version) {
    throw new TypeError("Instagram version not found or is currently excluded.");
  }

  const [master, connection] = await Promise.all([
    content.findOne({ _id: version.masterContentId }),
    connections.findOne({ _id: version.socialConnectionId }),
  ]);

  if (
    !master ||
    !connection ||
    !sameId(master.clientId, version.clientId) ||
    !sameId(connection.clientId, version.clientId) ||
    connection.platform !== "instagram"
  ) {
    throw new TypeError(
      "This Instagram version is no longer connected to the correct client destination.",
    );
  }

  const selectedMediaIds = Array.isArray(version.mediaIds) ? version.mediaIds : [];
  const mediaDocuments = selectedMediaIds.length
    ? await media
        .find({
          _id: { $in: selectedMediaIds },
          clientId: version.clientId,
          status: "uploaded",
        })
        .toArray()
    : [];
  const mediaById = new Map(
    mediaDocuments.map((asset) => [asset._id.toString(), asset]),
  );
  const orderedMedia = selectedMediaIds
    .map((mediaId) => mediaById.get(mediaId.toString()))
    .filter(Boolean);

  return {
    master,
    connection,
    orderedMedia,
    platformVersions,
    publishAttempts,
    selectedMediaIds,
    version,
  };
}

async function markAttemptProcessing({
  attemptId,
  providerContainerId,
  providerStatus = null,
  version,
  platformVersions,
  publishAttempts,
}) {
  const now = new Date();

  await publishAttempts.updateOne(
    { _id: attemptId },
    {
      $set: {
        status: "processing",
        providerContainerId,
        providerStatus,
        updatedAt: now,
      },
    },
  );

  const updatedVersion = await platformVersions.findOneAndUpdate(
    { _id: version._id, revision: version.revision },
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
      "Instagram accepted the media container, but the saved version changed before processing state could be recorded. Do not publish again until the recorded attempt is reviewed.",
      serializeDocument(await publishAttempts.findOne({ _id: attemptId })),
    );
  }

  return updatedVersion;
}

async function finalizeSuccessfulPublish({
  attemptId,
  providerContainerId,
  providerPostId,
  providerPostUrl,
  providerStatus = null,
  version,
  platformVersions,
  publishAttempts,
}) {
  const completedAt = new Date();

  await publishAttempts.updateOne(
    { _id: attemptId },
    {
      $set: {
        status: "succeeded",
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

  const updatedVersion = await platformVersions.findOneAndUpdate(
    { _id: version._id, revision: version.revision },
    {
      $set: {
        status: "published",
        publishedAt: completedAt,
        publishedRevision: Number(version.revision || 1),
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
      "Instagram published the post, but the saved version changed before the local result could be finalized. Do not publish again until the recorded attempt is reviewed.",
      serializeDocument(await publishAttempts.findOne({ _id: attemptId })),
    );
  }

  return updatedVersion;
}

async function markKnownContainerFailure({
  attemptId,
  providerError,
  version,
  platformVersions,
  publishAttempts,
}) {
  const completedAt = new Date();

  await publishAttempts.updateOne(
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

  await platformVersions.updateOne(
    { _id: version._id },
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

async function tryResolvePermalink(providerPostId, accessToken) {
  for (let index = 0; index < 3; index += 1) {
    try {
      const result = await getInstagramPublishedMedia({ providerPostId, accessToken });
      if (result.providerPostUrl) return result;
    } catch {
      // The publish already succeeded. A permalink read is best-effort and may
      // be retried later without creating another Instagram post.
    }

    if (index < 2) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return { providerPostId, providerPostUrl: "", providerMediaType: null };
}

async function completeReadyContainer({
  attemptId,
  providerContainerId,
  providerStatus,
  connection,
  accessToken,
  version,
  platformVersions,
  publishAttempts,
}) {
  let published;

  try {
    published = await publishInstagramContainer({
      accountId: connection.providerAccountId,
      accessToken,
      providerContainerId,
    });
  } catch (error) {
    const completedAt = new Date();
    const providerError = sanitizeInstagramProviderError(error);

    await publishAttempts.updateOne(
      { _id: attemptId },
      {
        $set: {
          status: "unknown",
          providerError,
          completedAt,
          updatedAt: completedAt,
        },
      },
    );
    await platformVersions.updateOne(
      { _id: version._id },
      {
        $set: {
          lastPublishAttemptId: attemptId,
          lastPublishStatus: "unknown",
          lastPublishError: providerError,
          updatedAt: completedAt,
        },
      },
    );

    throw new InstagramPublishProviderError(
      "Instagram publish result is uncertain. Do not publish this version again until the recorded attempt is reviewed.",
      serializeDocument(await publishAttempts.findOne({ _id: attemptId })),
    );
  }

  const remote = await tryResolvePermalink(published.providerPostId, accessToken);
  const updatedVersion = await finalizeSuccessfulPublish({
    attemptId,
    providerContainerId,
    providerPostId: published.providerPostId,
    providerPostUrl: remote.providerPostUrl,
    providerStatus,
    version,
    platformVersions,
    publishAttempts,
  });

  return serializeDocument({
    platformVersion: updatedVersion,
    attempt: await publishAttempts.findOne({ _id: attemptId }),
  });
}

async function checkContainerUntilReady({ providerContainerId, accessToken }) {
  let statusResult = null;

  for (let index = 0; index < 4; index += 1) {
    statusResult = await getInstagramContainerStatus({
      providerContainerId,
      accessToken,
    });

    if (statusResult.processingState !== "processing") return statusResult;
    if (index < 3) {
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }

  return statusResult;
}

export async function publishInstagramSingleImageVersion(versionId) {
  const {
    connection,
    orderedMedia,
    platformVersions,
    publishAttempts,
    selectedMediaIds,
    version,
  } = await loadInstagramPublishContext(versionId);

  const refreshedConnection = await refreshSocialConnectionHealth(
    connection._id.toString(),
  );

  if (!refreshedConnection) {
    throw new TypeError("The Instagram destination is no longer available.");
  }

  const validation = validateInstagramSingleImagePublishDraft({
    caption: version.caption,
    mediaIds: selectedMediaIds.map((id) => id.toString()),
    mediaAssets: orderedMedia.map(mediaView),
    healthStatus: refreshedConnection.healthStatus,
    canPublish: refreshedConnection.capabilities?.canPublish === true,
  });

  if (!validation.publishable) {
    throw new TypeError(validation.blocking.join(" "));
  }

  const providerAsset = await ensureInstagramImageAsset(orderedMedia[0]);

  const submissionKey = createInstagramSubmissionKey(
    version._id.toString(),
    Number(version.revision || 1),
  );
  const now = new Date();
  const attemptDocument = {
    platformVersionId: version._id,
    masterContentId: version.masterContentId,
    masterRevision: Number(version.masterRevisionSynced || 1),
    platformVersionRevision: Number(version.revision || 1),
    clientId: version.clientId,
    socialConnectionId: version.socialConnectionId,
    platform: "instagram",
    publishMode: "single_image",
    mediaAssetIds: selectedMediaIds,
    providerMedia: [],
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

  let attemptId;

  try {
    attemptId = (await publishAttempts.insertOne(attemptDocument)).insertedId;
  } catch (error) {
    if (error?.code !== 11000) throw error;

    const existing = await publishAttempts.findOne({ submissionKey });
    const existingView = existing ? serializeDocument(existing) : null;
    const message =
      existing?.status === "succeeded"
        ? "This exact Instagram version revision has already been published."
        : existing?.status === "processing"
          ? "This Instagram image has already been submitted and is still processing."
          : "A publish for this exact Instagram version revision is already in progress or requires review.";

    throw new InstagramPublishConflictError(message, existingView);
  }

  const accessToken = decryptSecret(connection.tokenEncrypted);
  const asset = providerAsset;
  let providerContainerId = "";

  try {
    const imageUrl = await createMediaViewUrl(asset.objectKey);
    const created = await createInstagramImageContainer({
      accountId: connection.providerAccountId,
      accessToken,
      imageUrl,
      caption: version.caption || "",
    });
    providerContainerId = created.providerContainerId;
    const providerMediaItem = {
      mediaAssetId: asset._id,
      providerContainerId,
      contentType: asset.contentType || "",
      providerObjectKey: asset.objectKey,
      instagramDerivative: asset.instagramDerivative === true,
      createdAt: new Date(),
    };

    await publishAttempts.updateOne(
      { _id: attemptId, status: "submitting" },
      {
        $push: { providerMedia: providerMediaItem },
        $set: {
          status: "processing",
          providerContainerId,
          updatedAt: new Date(),
        },
      },
    );

    const statusResult = await checkContainerUntilReady({
      providerContainerId,
      accessToken,
    });

    if (statusResult.processingState === "failed") {
      const providerError = {
        name: "InstagramContainerProcessingError",
        message: "Instagram reported that the image container failed processing.",
        code: null,
        type: "",
        errorSubcode: null,
        isTransient: false,
        userTitle: "",
        userMessage: "",
        traceId: "",
      };

      await markKnownContainerFailure({
        attemptId,
        providerError,
        version,
        platformVersions,
        publishAttempts,
      });

      throw new InstagramPublishProviderError(
        providerError.message,
        serializeDocument(await publishAttempts.findOne({ _id: attemptId })),
      );
    }

    if (statusResult.processingState !== "finished") {
      const updatedVersion = await markAttemptProcessing({
        attemptId,
        providerContainerId,
        providerStatus: statusResult.providerStatus,
        version,
        platformVersions,
        publishAttempts,
      });

      return serializeDocument({
        platformVersion: updatedVersion,
        attempt: await publishAttempts.findOne({ _id: attemptId }),
      });
    }

    return completeReadyContainer({
      attemptId,
      providerContainerId,
      providerStatus: statusResult.providerStatus,
      connection,
      accessToken,
      version,
      platformVersions,
      publishAttempts,
    });
  } catch (error) {
    if (
      error instanceof InstagramPublishProviderError ||
      error instanceof InstagramPublishConflictError
    ) {
      throw error;
    }

    const completedAt = new Date();
    const providerError = sanitizeInstagramProviderError(error);
    const definitiveFailure =
      isDefinitiveInstagramProviderFailure(error) && !providerContainerId;
    const attemptStatus = definitiveFailure ? "failed" : "unknown";
    const attemptUpdate = {
      $set: {
        status: attemptStatus,
        providerError,
        completedAt,
        updatedAt: completedAt,
      },
    };

    if (definitiveFailure) {
      attemptUpdate.$unset = { submissionKey: "" };
    }

    await publishAttempts.updateOne({ _id: attemptId }, attemptUpdate);
    await platformVersions.updateOne(
      { _id: version._id },
      {
        $set: {
          lastPublishAttemptId: attemptId,
          lastPublishStatus: attemptStatus,
          lastPublishError: providerError,
          updatedAt: completedAt,
        },
      },
    );

    throw new InstagramPublishProviderError(
      definitiveFailure
        ? providerError.message
        : "Instagram publish result is uncertain. Do not publish this version again until the recorded attempt is reviewed.",
      serializeDocument(await publishAttempts.findOne({ _id: attemptId })),
    );
  }
}

export async function checkInstagramPublishStatus(versionId) {
  const {
    connection,
    platformVersions,
    publishAttempts,
    version,
  } = await loadInstagramPublishContext(versionId);
  const attemptId = version.lastPublishAttemptId;

  if (!attemptId) {
    throw new TypeError("No Instagram publish attempt is available to check.");
  }

  const attempt = await publishAttempts.findOne({
    _id: attemptId,
    platformVersionId: version._id,
    publishMode: "single_image",
  });

  if (!attempt) {
    throw new TypeError("No Instagram publish attempt is available to check.");
  }

  const accessToken = decryptSecret(connection.tokenEncrypted);

  if (attempt.status === "succeeded") {
    if (attempt.providerPostUrl || !attempt.providerPostId) {
      return serializeDocument({ platformVersion: version, attempt });
    }

    const remote = await tryResolvePermalink(attempt.providerPostId, accessToken);
    if (remote.providerPostUrl) {
      await publishAttempts.updateOne(
        { _id: attempt._id },
        { $set: { providerPostUrl: remote.providerPostUrl, updatedAt: new Date() } },
      );
      await platformVersions.updateOne(
        { _id: version._id },
        { $set: { providerPostUrl: remote.providerPostUrl, updatedAt: new Date() } },
      );
    }

    return serializeDocument({
      platformVersion: await platformVersions.findOne({ _id: version._id }),
      attempt: await publishAttempts.findOne({ _id: attempt._id }),
    });
  }

  if (attempt.status !== "processing" || !attempt.providerContainerId) {
    throw new TypeError(
      "This Instagram publish attempt is not currently waiting for provider processing.",
    );
  }

  let statusResult;

  try {
    statusResult = await getInstagramContainerStatus({
      providerContainerId: attempt.providerContainerId,
      accessToken,
    });
  } catch (error) {
    throw new InstagramPublishProviderError(
      "Unable to refresh Instagram container status. The existing attempt remains recorded; do not republish it.",
      {
        ...serializeDocument(attempt),
        providerError: sanitizeInstagramProviderError(error),
      },
    );
  }

  if (statusResult.processingState === "failed") {
    const providerError = {
      name: "InstagramContainerProcessingError",
      message: "Instagram reported that the image container failed processing.",
      code: null,
      type: "",
      errorSubcode: null,
      isTransient: false,
      userTitle: "",
      userMessage: "",
      traceId: "",
    };

    await markKnownContainerFailure({
      attemptId: attempt._id,
      providerError,
      version,
      platformVersions,
      publishAttempts,
    });

    return serializeDocument({
      platformVersion: await platformVersions.findOne({ _id: version._id }),
      attempt: await publishAttempts.findOne({ _id: attempt._id }),
    });
  }

  if (statusResult.processingState === "finished") {
    return completeReadyContainer({
      attemptId: attempt._id,
      providerContainerId: attempt.providerContainerId,
      providerStatus: statusResult.providerStatus,
      connection,
      accessToken,
      version,
      platformVersions,
      publishAttempts,
    });
  }

  await publishAttempts.updateOne(
    { _id: attempt._id },
    {
      $set: {
        providerStatus: statusResult.providerStatus,
        updatedAt: new Date(),
      },
    },
  );

  return serializeDocument({
    platformVersion: version,
    attempt: await publishAttempts.findOne({ _id: attempt._id }),
  });
}
