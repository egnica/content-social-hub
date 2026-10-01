import "server-only";

import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import { InstagramPublishConflictError } from "@/lib/instagram-publishing";

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

function sameId(left, right) {
  return String(left || "") === String(right || "");
}

export function instagramCarouselMediaView(asset) {
  return {
    _id: asset._id.toString(),
    contentType: asset.contentType || "",
    size: Number(asset.size || 0),
    width: Number(asset.width || 0),
    height: Number(asset.height || 0),
    aspectRatio: Number(asset.aspectRatio || 0),
    duration: Number(asset.duration || 0),
    originalName: asset.originalName || "",
  };
}

export async function loadInstagramCarouselPublishContext(versionId) {
  const platformVersionId = toObjectId(versionId);
  if (!platformVersionId) throw new TypeError("Instagram version not found.");

  const collections = await publishingCollections();
  const version = await collections.platformVersions.findOne({
    _id: platformVersionId,
    platform: "instagram",
    active: { $ne: false },
  });

  if (!version) {
    throw new TypeError("Instagram version not found or is currently excluded.");
  }

  const [master, connection] = await Promise.all([
    collections.content.findOne({ _id: version.masterContentId }),
    collections.connections.findOne({ _id: version.socialConnectionId }),
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
    ? await collections.media
        .find({
          _id: { $in: selectedMediaIds },
          clientId: version.clientId,
          status: "uploaded",
        })
        .toArray()
    : [];
  const byId = new Map(
    mediaDocuments.map((asset) => [asset._id.toString(), asset]),
  );
  const orderedMedia = selectedMediaIds
    .map((mediaId) => byId.get(mediaId.toString()))
    .filter(Boolean);

  return {
    ...collections,
    connection,
    master,
    orderedMedia,
    selectedMediaIds,
    version,
  };
}

export async function createCarouselPublishAttempt({ context, submissionKey }) {
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
    publishMode: "carousel",
    mediaAssetIds: selectedMediaIds,
    providerMedia: [],
    providerStage: "children",
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
        ? "This exact Instagram version revision has already been published."
        : ["submitting", "processing"].includes(existing?.status)
          ? "This Instagram carousel has already been submitted and is still in progress."
          : "A publish for this exact Instagram version revision is already in progress or requires review.";

    throw new InstagramPublishConflictError(
      message,
      existing ? serializeDocument(existing) : null,
    );
  }
}

export async function setCarouselVersionProcessing({
  context,
  attemptId,
  providerContainerId = "",
}) {
  const { platformVersions, publishAttempts, version } = context;
  const now = new Date();
  const update = {
    status: "processing",
    lastPublishAttemptId: attemptId,
    lastPublishStatus: "processing",
    lastPublishError: null,
    updatedAt: now,
  };
  if (providerContainerId) update.providerContainerId = providerContainerId;

  const updatedVersion = await platformVersions.findOneAndUpdate(
    { _id: version._id, revision: version.revision },
    { $set: update },
    { returnDocument: "after" },
  );

  if (!updatedVersion) {
    throw new InstagramPublishConflictError(
      "Instagram accepted carousel containers, but the saved version changed before processing state could be recorded. Do not publish again until the recorded attempt is reviewed.",
      serializeDocument(await publishAttempts.findOne({ _id: attemptId })),
    );
  }

  return updatedVersion;
}

export async function markCarouselRetrySafeFailure({
  context,
  attemptId,
  providerError,
}) {
  const { platformVersions, publishAttempts, version } = context;
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
    { _id: version._id, revision: version.revision },
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

export async function markCarouselUnknown({
  context,
  attemptId,
  providerError,
}) {
  const { platformVersions, publishAttempts, version } = context;
  const completedAt = new Date();

  await publishAttempts.updateOne(
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
  await platformVersions.updateOne(
    { _id: version._id, revision: version.revision },
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

export async function claimCarouselParentPublish({ context, attempt }) {
  const { platformVersions, publishAttempts, version } = context;
  const claimedAt = new Date();
  const claimed = await publishAttempts.findOneAndUpdate(
    {
      _id: attempt._id,
      status: "processing",
      providerStage: "parent",
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
      "This Instagram carousel parent is already being published or requires review. Do not submit it again.",
      serializeDocument(await publishAttempts.findOne({ _id: attempt._id })),
    );
  }

  const versionResult = await platformVersions.updateOne(
    { _id: version._id, revision: version.revision },
    {
      $set: {
        lastPublishAttemptId: attempt._id,
        lastPublishStatus: "submitting",
        updatedAt: claimedAt,
      },
    },
  );

  if (versionResult.matchedCount !== 1) {
    const providerError = {
      name: "InstagramCarouselRevisionConflict",
      message:
        "The saved Instagram version changed before the carousel parent could be published.",
      code: null,
      type: "",
      errorSubcode: null,
      isTransient: false,
      userTitle: "",
      userMessage: "",
      traceId: "",
    };
    await publishAttempts.updateOne(
      { _id: claimed._id, status: "submitting" },
      {
        $set: {
          status: "failed",
          providerError,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
        $unset: { submissionKey: "" },
      },
    );
    throw new InstagramPublishConflictError(
      `${providerError.message} No Instagram post was submitted by this attempt.`,
      serializeDocument(await publishAttempts.findOne({ _id: claimed._id })),
    );
  }

  return claimed;
}

export async function finalizeCarouselSuccess({
  context,
  attemptId,
  providerContainerId,
  providerPostId,
  providerPostUrl,
  providerStatus = null,
}) {
  const { platformVersions, publishAttempts, version } = context;
  const completedAt = new Date();

  await publishAttempts.updateOne(
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
      "Instagram published the carousel, but the saved version changed before the local result could be finalized. Do not publish again until the recorded attempt is reviewed.",
      serializeDocument(await publishAttempts.findOne({ _id: attemptId })),
    );
  }

  return serializeDocument({
    platformVersion: updatedVersion,
    attempt: await publishAttempts.findOne({ _id: attemptId }),
  });
}

export function serializeCarouselBundle(_context, platformVersion, attempt) {
  return serializeDocument({ platformVersion, attempt });
}
