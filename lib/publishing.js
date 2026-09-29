import "server-only";

import { refreshSocialConnectionHealth } from "@/lib/connections";
import {
  publishFacebookPageFeed,
  publishFacebookPageImageFeed,
  uploadFacebookPagePhoto,
} from "@/lib/facebook-publisher";
import {
  buildFacebookFeedPayload,
  buildFacebookImagePostMessage,
  createFacebookSubmissionKey,
  isDefinitiveFacebookProviderFailure,
  orderFacebookImageAssets,
  sanitizeFacebookProviderError,
  validateFacebookPublishDraft,
} from "@/lib/facebook-publish-logic";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import { decryptSecret } from "@/lib/secure-values";
import { readMediaObject } from "@/lib/s3";

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

export class PublishConflictError extends Error {
  constructor(message, attempt = null) {
    super(message);
    this.name = "PublishConflictError";
    this.attempt = attempt;
  }
}

export class PublishProviderError extends Error {
  constructor(message, attempt = null) {
    super(message);
    this.name = "PublishProviderError";
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
  };
}

export async function publishFacebookTextLinkVersion(versionId) {
  const platformVersionId = toObjectId(versionId);

  if (!platformVersionId) {
    throw new TypeError("Facebook version not found.");
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
    platform: "facebook",
    active: { $ne: false },
  });

  if (!version) {
    throw new TypeError("Facebook version not found or is currently excluded.");
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
    connection.platform !== "facebook"
  ) {
    throw new TypeError(
      "This Facebook version is no longer connected to the correct client destination.",
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

  const refreshedConnection = await refreshSocialConnectionHealth(
    connection._id.toString(),
  );

  if (!refreshedConnection) {
    throw new TypeError("The Facebook destination is no longer available.");
  }

  const validation = validateFacebookPublishDraft({
    message: version.message,
    destinationUrl: version.destinationUrl,
    mediaIds: selectedMediaIds.map((id) => id.toString()),
    mediaAssets: orderedMedia.map(mediaView),
    healthStatus: refreshedConnection.healthStatus,
    canPublish: refreshedConnection.capabilities?.canPublish === true,
    masterChanged:
      Number(version.masterRevisionSynced || 0) !== Number(master.revision || 0),
    customized: version.customized === true,
  });

  if (!validation.publishable) {
    throw new TypeError(validation.blocking.join(" "));
  }

  const submissionKey = createFacebookSubmissionKey(
    version._id.toString(),
    Number(version.revision || 1),
  );
  const now = new Date();
  const attemptDocument = {
    platformVersionId: version._id,
    masterContentId: version.masterContentId,
    masterRevision: Number(master.revision || 1),
    platformVersionRevision: Number(version.revision || 1),
    clientId: version.clientId,
    socialConnectionId: version.socialConnectionId,
    platform: "facebook",
    publishMode: validation.publishMode,
    mediaAssetIds: selectedMediaIds,
    providerMedia: [],
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
        ? "This exact Facebook version revision has already been published."
        : "A publish for this exact Facebook version revision is already in progress or requires review.";

    throw new PublishConflictError(message, existingView);
  }

  const pageAccessToken = decryptSecret(connection.tokenEncrypted);
  const providerMedia = [];
  let providerResult;

  try {
    if (validation.publishMode === "image") {
      const images = orderFacebookImageAssets(
        orderedMedia,
        version.primaryMediaId?.toString() || "",
      );

      for (const asset of images) {
        const object = await readMediaObject(asset.objectKey);
        const uploaded = await uploadFacebookPagePhoto({
          pageId: connection.providerAccountId,
          pageAccessToken,
          bytes: object.bytes,
          contentType: asset.contentType || object.contentType,
          filename: asset.originalName || "facebook-image",
        });
        const providerMediaItem = {
          mediaAssetId: asset._id,
          providerMediaId: uploaded.providerMediaId,
          uploadedAt: new Date(),
        };
        providerMedia.push(providerMediaItem);

        await publishAttempts.updateOne(
          { _id: attemptId, status: "submitting" },
          {
            $push: { providerMedia: providerMediaItem },
            $set: { updatedAt: new Date() },
          },
        );
      }

      providerResult = await publishFacebookPageImageFeed({
        pageId: connection.providerAccountId,
        pageAccessToken,
        message: buildFacebookImagePostMessage(version),
        providerMediaIds: providerMedia.map((item) => item.providerMediaId),
      });
    } else {
      providerResult = await publishFacebookPageFeed({
        pageId: connection.providerAccountId,
        pageAccessToken,
        ...buildFacebookFeedPayload(version),
      });
    }
  } catch (error) {
    const completedAt = new Date();
    const providerError = sanitizeFacebookProviderError(error);
    const providerTouched = providerMedia.length > 0;
    const definitiveFailure =
      isDefinitiveFacebookProviderFailure(error) && !providerTouched;
    const attemptStatus = definitiveFailure ? "failed" : "unknown";
    const attemptUpdate = {
      $set: {
        status: attemptStatus,
        providerError,
        completedAt,
        updatedAt: completedAt,
      },
    };

    // A definite Graph API rejection before any remote media exists is safe to
    // retry later. Once Meta has accepted a photo upload, keep the idempotency
    // key even if the later feed submission fails so a retry cannot silently
    // duplicate the media/post workflow.
    if (definitiveFailure) {
      attemptUpdate.$unset = { submissionKey: "" };
    }

    await publishAttempts.updateOne(
      { _id: attemptId, status: "submitting" },
      attemptUpdate,
    );

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

    const publicMessage = definitiveFailure
      ? providerError.message
      : "Facebook publish result is uncertain. Do not publish this version again until the recorded attempt is reviewed.";

    throw new PublishProviderError(
      publicMessage,
      serializeDocument(await publishAttempts.findOne({ _id: attemptId })),
    );
  }

  const completedAt = new Date();

  await publishAttempts.updateOne(
    { _id: attemptId, status: "submitting" },
    {
      $set: {
        status: "succeeded",
        providerPostId: providerResult.providerPostId,
        providerPostUrl: providerResult.providerPostUrl,
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
        providerMediaIds: providerMedia.map((item) => item.providerMediaId),
        providerPostId: providerResult.providerPostId,
        providerPostUrl: providerResult.providerPostUrl,
        updatedAt: completedAt,
      },
    },
    { returnDocument: "after" },
  );

  if (!updatedVersion) {
    throw new PublishConflictError(
      "Facebook accepted the post, but the saved version changed before the local result could be finalized. Do not publish again until the recorded attempt is reviewed.",
      serializeDocument(
        await publishAttempts.findOne({ _id: attemptId }),
      ),
    );
  }

  return serializeDocument({
    platformVersion: updatedVersion,
    attempt: await publishAttempts.findOne({ _id: attemptId }),
  });
}
