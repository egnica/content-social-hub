import "server-only";

import { refreshSocialConnectionHealth } from "@/lib/connections";
import {
  finishFacebookPageVideoUpload,
  getFacebookPageVideoStatus,
  publishFacebookPageFeed,
  publishFacebookPageImageFeed,
  startFacebookPageVideoUpload,
  transferFacebookPageVideoChunk,
  uploadFacebookPagePhoto,
} from "@/lib/facebook-publisher";
import {
  buildFacebookFeedPayload,
  buildFacebookImagePostMessage,
  buildFacebookVideoDescription,
  buildFacebookVideoUrl,
  createFacebookSubmissionKey,
  isDefinitiveFacebookProviderFailure,
  orderFacebookImageAssets,
  sanitizeFacebookProviderError,
  validateFacebookPublishDraft,
} from "@/lib/facebook-publish-logic";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import { decryptSecret } from "@/lib/secure-values";
import { readMediaObject, readMediaObjectRange } from "@/lib/s3";

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

async function loadPublishContext(versionId) {
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

async function markVideoProcessing({
  attemptId,
  providerStatus,
  providerVideoId,
  providerPostId,
  providerPostUrl,
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
        providerVideoId,
        providerPostId: providerPostId || providerVideoId,
        providerPostUrl,
        providerStatus: providerStatus || null,
        completedAt: null,
        updatedAt: now,
      },
    },
  );

  return platformVersions.findOneAndUpdate(
    { _id: version._id, revision: version.revision },
    {
      $set: {
        status: "processing",
        lastPublishAttemptId: attemptId,
        lastPublishStatus: "processing",
        lastPublishError: null,
        providerVideoId,
        providerPostId: providerPostId || providerVideoId,
        providerPostUrl,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
}

async function finalizeSuccessfulPublish({
  attemptId,
  providerMediaIds = [],
  providerPostId,
  providerPostUrl,
  providerVideoId = "",
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
        providerVideoId,
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
        providerMediaIds,
        providerVideoId,
        providerPostId,
        providerPostUrl,
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

  return updatedVersion;
}

async function markKnownVideoFailure({
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

export async function publishFacebookTextLinkVersion(versionId) {
  const {
    connection,
    master,
    orderedMedia,
    platformVersions,
    publishAttempts,
    selectedMediaIds,
    version,
  } = await loadPublishContext(versionId);

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
    providerVideoId: "",
    providerStatus: null,
    bytesUploaded: 0,
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
        : existing?.status === "processing"
          ? "This Facebook video has already been submitted and is still processing."
          : "A publish for this exact Facebook version revision is already in progress or requires review.";

    throw new PublishConflictError(message, existingView);
  }

  const pageAccessToken = decryptSecret(connection.tokenEncrypted);
  const providerMedia = [];
  let providerVideoId = "";
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
    } else if (validation.publishMode === "video") {
      const asset = orderedMedia[0];
      const started = await startFacebookPageVideoUpload({
        pageId: connection.providerAccountId,
        pageAccessToken,
        fileSize: Number(asset.size),
      });
      providerVideoId = started.providerVideoId;

      await publishAttempts.updateOne(
        { _id: attemptId },
        {
          $set: {
            status: "uploading",
            providerVideoId,
            providerPostId: providerVideoId,
            providerPostUrl: buildFacebookVideoUrl(
              connection.providerAccountId,
              providerVideoId,
            ),
            bytesUploaded: Number(started.startOffset || 0),
            updatedAt: new Date(),
          },
        },
      );

      let startOffset = started.startOffset;
      let endOffset = started.endOffset;
      let safetyCounter = 0;

      while (startOffset < endOffset) {
        if (safetyCounter++ > 10000) {
          throw new Error("Facebook video upload did not make bounded progress.");
        }

        const object = await readMediaObjectRange(
          asset.objectKey,
          startOffset,
          endOffset,
        );
        const transferred = await transferFacebookPageVideoChunk({
          pageId: connection.providerAccountId,
          pageAccessToken,
          uploadSessionId: started.uploadSessionId,
          startOffset,
          bytes: object.bytes,
          contentType: asset.contentType || object.contentType,
          filename: asset.originalName || "facebook-video",
        });

        if (transferred.startOffset <= startOffset && transferred.endOffset > startOffset) {
          throw new Error("Facebook video upload did not advance to the next chunk.");
        }

        startOffset = transferred.startOffset;
        endOffset = transferred.endOffset;

        await publishAttempts.updateOne(
          { _id: attemptId },
          {
            $set: {
              bytesUploaded: Math.min(startOffset, Number(asset.size)),
              updatedAt: new Date(),
            },
          },
        );
      }

      await finishFacebookPageVideoUpload({
        pageId: connection.providerAccountId,
        pageAccessToken,
        uploadSessionId: started.uploadSessionId,
        description: buildFacebookVideoDescription(version),
      });

      let statusResult = {
        providerVideoId,
        providerPostId: providerVideoId,
        providerPostUrl: buildFacebookVideoUrl(
          connection.providerAccountId,
          providerVideoId,
        ),
        processingState: "processing",
        providerStatus: null,
      };

      try {
        statusResult = await getFacebookPageVideoStatus({
          pageId: connection.providerAccountId,
          pageAccessToken,
          providerVideoId,
        });
      } catch {
        // Meta accepted the complete upload. A temporary status-read failure does
        // not make it safe to submit another video, so preserve Processing state.
      }

      if (statusResult.processingState === "failed") {
        const providerError = {
          name: "FacebookVideoProcessingError",
          message: "Facebook reported that the uploaded video failed processing.",
          code: null,
          type: "",
          errorSubcode: null,
          isTransient: false,
          userTitle: "",
          userMessage: "",
          traceId: "",
        };

        await markKnownVideoFailure({
          attemptId,
          providerError,
          version,
          platformVersions,
          publishAttempts,
        });

        throw new PublishProviderError(
          providerError.message,
          serializeDocument(await publishAttempts.findOne({ _id: attemptId })),
        );
      }

      if (statusResult.processingState !== "succeeded") {
        const updatedVersion = await markVideoProcessing({
          attemptId,
          providerStatus: statusResult.providerStatus,
          providerVideoId,
          providerPostId: statusResult.providerPostId,
          providerPostUrl: statusResult.providerPostUrl,
          version,
          platformVersions,
          publishAttempts,
        });

        if (!updatedVersion) {
          throw new PublishConflictError(
            "Facebook accepted the video, but the saved version changed before processing state could be recorded. Do not publish again until the recorded attempt is reviewed.",
            serializeDocument(await publishAttempts.findOne({ _id: attemptId })),
          );
        }

        return serializeDocument({
          platformVersion: updatedVersion,
          attempt: await publishAttempts.findOne({ _id: attemptId }),
        });
      }

      providerResult = statusResult;
    } else {
      providerResult = await publishFacebookPageFeed({
        pageId: connection.providerAccountId,
        pageAccessToken,
        ...buildFacebookFeedPayload(version),
      });
    }
  } catch (error) {
    if (error instanceof PublishProviderError || error instanceof PublishConflictError) {
      throw error;
    }

    const completedAt = new Date();
    const providerError = sanitizeFacebookProviderError(error);
    const providerTouched =
      providerMedia.length > 0 || Boolean(providerVideoId);
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

    if (definitiveFailure) {
      attemptUpdate.$unset = { submissionKey: "" };
    }

    await publishAttempts.updateOne(
      { _id: attemptId },
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

  const updatedVersion = await finalizeSuccessfulPublish({
    attemptId,
    providerMediaIds:
      validation.publishMode === "video"
        ? [providerVideoId]
        : providerMedia.map((item) => item.providerMediaId),
    providerPostId: providerResult.providerPostId,
    providerPostUrl: providerResult.providerPostUrl,
    providerVideoId,
    providerStatus: providerResult.providerStatus || null,
    version,
    platformVersions,
    publishAttempts,
  });

  return serializeDocument({
    platformVersion: updatedVersion,
    attempt: await publishAttempts.findOne({ _id: attemptId }),
  });
}

export async function checkFacebookVideoPublishStatus(versionId) {
  const {
    connection,
    platformVersions,
    publishAttempts,
    version,
  } = await loadPublishContext(versionId);
  const attemptId = version.lastPublishAttemptId;

  if (!attemptId) {
    throw new TypeError("No Facebook video publish attempt is available to check.");
  }

  const attempt = await publishAttempts.findOne({
    _id: attemptId,
    platformVersionId: version._id,
    publishMode: "video",
  });

  if (!attempt?.providerVideoId) {
    throw new TypeError("No Facebook video ID is available to check.");
  }

  if (attempt.status === "succeeded") {
    return serializeDocument({
      platformVersion: version,
      attempt,
    });
  }

  if (attempt.status !== "processing") {
    throw new TypeError(
      "This Facebook video is not currently waiting for provider processing.",
    );
  }

  const pageAccessToken = decryptSecret(connection.tokenEncrypted);
  let statusResult;

  try {
    statusResult = await getFacebookPageVideoStatus({
      pageId: connection.providerAccountId,
      pageAccessToken,
      providerVideoId: attempt.providerVideoId,
    });
  } catch (error) {
    const providerError = sanitizeFacebookProviderError(error);

    throw new PublishProviderError(
      "Unable to refresh Facebook video processing status. The existing video remains recorded; do not republish it.",
      {
        ...serializeDocument(attempt),
        providerError,
      },
    );
  }

  if (statusResult.processingState === "failed") {
    const providerError = {
      name: "FacebookVideoProcessingError",
      message: "Facebook reported that the uploaded video failed processing.",
      code: null,
      type: "",
      errorSubcode: null,
      isTransient: false,
      userTitle: "",
      userMessage: "",
      traceId: "",
    };

    await markKnownVideoFailure({
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

  if (statusResult.processingState === "succeeded") {
    const updatedVersion = await finalizeSuccessfulPublish({
      attemptId: attempt._id,
      providerMediaIds: [attempt.providerVideoId],
      providerPostId: statusResult.providerPostId,
      providerPostUrl: statusResult.providerPostUrl,
      providerVideoId: attempt.providerVideoId,
      providerStatus: statusResult.providerStatus,
      version,
      platformVersions,
      publishAttempts,
    });

    return serializeDocument({
      platformVersion: updatedVersion,
      attempt: await publishAttempts.findOne({ _id: attempt._id }),
    });
  }

  await publishAttempts.updateOne(
    { _id: attempt._id },
    {
      $set: {
        providerPostId: statusResult.providerPostId,
        providerPostUrl: statusResult.providerPostUrl,
        providerStatus: statusResult.providerStatus,
        updatedAt: new Date(),
      },
    },
  );

  await platformVersions.updateOne(
    { _id: version._id },
    {
      $set: {
        status: "processing",
        lastPublishStatus: "processing",
        providerVideoId: attempt.providerVideoId,
        providerPostId: statusResult.providerPostId,
        providerPostUrl: statusResult.providerPostUrl,
        updatedAt: new Date(),
      },
    },
  );

  return serializeDocument({
    platformVersion: await platformVersions.findOne({ _id: version._id }),
    attempt: await publishAttempts.findOne({ _id: attempt._id }),
  });
}
