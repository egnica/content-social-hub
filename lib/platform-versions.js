import "server-only";

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import {
  buildInheritedFacebookFields,
  isPublishableFacebookConnection,
  normalizeFacebookVersionDraft,
  planPlatformVersionSelection,
  uniqueStringIds,
} from "@/lib/platform-version-logic";

let platformIndexesPromise;

async function platformCollections() {
  const db = await getDb();

  if (!platformIndexesPromise) {
    platformIndexesPromise = Promise.all([
      db.collection("platform_versions").createIndex(
        { masterContentId: 1, socialConnectionId: 1 },
        { unique: true },
      ),
      db.collection("platform_versions").createIndex({
        clientId: 1,
        platform: 1,
        active: 1,
        updatedAt: -1,
      }),
      db.collection("platform_versions").createIndex({
        masterContentId: 1,
        updatedAt: -1,
      }),
    ]).catch((error) => {
      platformIndexesPromise = undefined;
      throw error;
    });
  }

  await platformIndexesPromise;

  return {
    content: db.collection("master_content"),
    connections: db.collection("social_connections"),
    media: db.collection("media_assets"),
    platformVersions: db.collection("platform_versions"),
  };
}

function connectionView(connection, clientId) {
  return {
    _id: connection._id,
    clientId: connection.clientId,
    platform: connection.platform,
    providerAccountId: connection.providerAccountId,
    accountName: connection.accountName,
    pictureUrl: connection.pictureUrl || "",
    healthStatus: connection.healthStatus,
    healthMessage: connection.healthMessage || "",
    canPublish: connection.capabilities?.canPublish === true,
    selectable: isPublishableFacebookConnection(connection, clientId),
  };
}

async function attachVideoThumbnailViews(media, versions) {
  const thumbnailIds = [
    ...new Map(
      versions
        .filter((version) => version.videoThumbnailMediaId)
        .map((version) => [
          version.videoThumbnailMediaId.toString(),
          version.videoThumbnailMediaId,
        ]),
    ).values(),
  ];

  if (!thumbnailIds.length) return versions;

  const thumbnailDocuments = await media
    .find({
      _id: { $in: thumbnailIds },
      status: "uploaded",
      contentType: /^image\//,
    })
    .toArray();
  const thumbnailById = new Map(
    thumbnailDocuments.map((asset) => [asset._id.toString(), asset]),
  );

  return versions.map((version) => ({
    ...version,
    videoThumbnail: version.videoThumbnailMediaId
      ? thumbnailById.get(version.videoThumbnailMediaId.toString()) || null
      : null,
  }));
}

export async function getPlatformDestinationState(contentId) {
  const masterContentId = toObjectId(contentId);

  if (!masterContentId) return null;

  const { content, connections, media, platformVersions } =
    await platformCollections();
  const master = await content.findOne({ _id: masterContentId });

  if (!master) return null;

  const [connectionDocuments, versionDocuments] = await Promise.all([
    connections
      .find(
        { clientId: master.clientId, platform: "facebook" },
        {
          projection: {
            clientId: 1,
            platform: 1,
            providerAccountId: 1,
            accountName: 1,
            pictureUrl: 1,
            healthStatus: 1,
            healthMessage: 1,
            capabilities: 1,
          },
        },
      )
      .sort({ accountName: 1 })
      .toArray(),
    platformVersions
      .find({ masterContentId })
      .sort({ createdAt: 1 })
      .toArray(),
  ]);
  const hydratedVersions = await attachVideoThumbnailViews(
    media,
    versionDocuments,
  );

  return serializeDocument({
    destinations: connectionDocuments.map((connection) =>
      connectionView(connection, master.clientId),
    ),
    platformVersions: hydratedVersions,
  });
}

export async function syncPlatformVersionSelection(
  contentId,
  selectedConnectionIds,
) {
  const masterContentId = toObjectId(contentId);

  if (!masterContentId) {
    throw new TypeError("Content not found.");
  }

  const requestedIds = uniqueStringIds(selectedConnectionIds);
  const requestedObjectIds = requestedIds.map((id) => toObjectId(id));

  if (requestedObjectIds.some((id) => !id)) {
    throw new TypeError("Choose valid social destinations.");
  }

  const { content, connections, platformVersions } = await platformCollections();
  const master = await content.findOne({ _id: masterContentId });

  if (!master) {
    throw new TypeError("Content not found.");
  }

  const selectedConnections = requestedObjectIds.length
    ? await connections
        .find({
          _id: { $in: requestedObjectIds },
          clientId: master.clientId,
          platform: "facebook",
        })
        .toArray()
    : [];

  const eligibleConnections = selectedConnections.filter((connection) =>
    isPublishableFacebookConnection(connection, master.clientId),
  );

  if (eligibleConnections.length !== requestedIds.length) {
    throw new TypeError(
      "One or more selected Facebook Pages are unavailable, unhealthy, or belong to another client.",
    );
  }

  const existingVersions = await platformVersions
    .find({ masterContentId })
    .toArray();
  const plan = planPlatformVersionSelection({
    existingVersions: existingVersions.map((version) => ({
      socialConnectionId: version.socialConnectionId?.toString(),
      active: version.active !== false,
    })),
    selectedConnectionIds: requestedIds,
  });
  const now = new Date();
  const connectionsById = new Map(
    eligibleConnections.map((connection) => [connection._id.toString(), connection]),
  );
  const inherited = buildInheritedFacebookFields({
    text: master.text,
    primaryUrl: master.primaryUrl,
    mediaIds: (master.mediaIds || []).map((id) => id.toString()),
    defaultPrimaryMediaId: master.defaultPrimaryMediaId?.toString() || "",
    defaultVideoThumbnailMediaId:
      master.defaultVideoThumbnailMediaId?.toString() || "",
    revision: master.revision,
  });

  for (const connectionId of plan.create) {
    const connection = connectionsById.get(connectionId);
    const socialConnectionId = new ObjectId(connectionId);

    await platformVersions.updateOne(
      { masterContentId, socialConnectionId },
      {
        $setOnInsert: {
          masterContentId,
          clientId: master.clientId,
          socialConnectionId,
          platform: "facebook",
          providerAccountId: connection.providerAccountId,
          destinationName: connection.accountName,
          destinationPictureUrl: connection.pictureUrl || "",
          message: inherited.message,
          destinationUrl: inherited.destinationUrl,
          mediaIds: inherited.mediaIds.map((id) => new ObjectId(id)),
          primaryMediaId: inherited.primaryMediaId
            ? new ObjectId(inherited.primaryMediaId)
            : null,
          videoThumbnailMediaId: inherited.videoThumbnailMediaId
            ? new ObjectId(inherited.videoThumbnailMediaId)
            : null,
          masterRevisionSynced: inherited.masterRevisionSynced,
          customized: false,
          status: "draft",
          revision: 1,
          createdAt: now,
        },
        $set: {
          active: true,
          excludedAt: null,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
  }

  if (plan.reactivate.length) {
    await platformVersions.updateMany(
      {
        masterContentId,
        socialConnectionId: {
          $in: plan.reactivate.map((id) => new ObjectId(id)),
        },
      },
      {
        $set: {
          active: true,
          excludedAt: null,
          updatedAt: now,
        },
      },
    );
  }

  if (plan.exclude.length) {
    await platformVersions.updateMany(
      {
        masterContentId,
        socialConnectionId: {
          $in: plan.exclude.map((id) => new ObjectId(id)),
        },
      },
      {
        $set: {
          active: false,
          excludedAt: now,
          updatedAt: now,
        },
      },
    );
  }

  return getPlatformDestinationState(contentId);
}

async function getEditableFacebookVersion(versionId) {
  const objectId = toObjectId(versionId);

  if (!objectId) {
    throw new TypeError("Facebook version not found.");
  }

  const { content, connections, media, platformVersions } =
    await platformCollections();
  const version = await platformVersions.findOne({
    _id: objectId,
    platform: "facebook",
    active: { $ne: false },
  });

  if (!version) {
    throw new TypeError("Facebook version not found or is currently excluded.");
  }

  const [master, connection] = await Promise.all([
    content.findOne({ _id: version.masterContentId }),
    connections.findOne({
      _id: version.socialConnectionId,
      clientId: version.clientId,
      platform: "facebook",
    }),
  ]);

  if (!master || !connection || !master.clientId.equals(version.clientId)) {
    throw new TypeError("Facebook version is no longer connected to valid client content.");
  }

  return { master, connection, media, platformVersions, version };
}

async function resolveFacebookThumbnailMediaId(media, version, requestedId) {
  const normalizedId = String(requestedId || "").trim();
  if (!normalizedId) return null;

  const objectId = toObjectId(normalizedId);
  if (!objectId) {
    throw new TypeError("Choose a valid Facebook video thumbnail image.");
  }

  const asset = await media.findOne({
    _id: objectId,
    clientId: version.clientId,
    status: "uploaded",
    contentType: /^image\//,
  });

  if (!asset) {
    throw new TypeError("Choose a valid Facebook video thumbnail image.");
  }

  return asset._id;
}

export async function saveFacebookPlatformVersion(versionId, input) {
  const { master, media, platformVersions, version } =
    await getEditableFacebookVersion(versionId);
  const allowedMediaIds = (master.mediaIds || []).map((id) => id.toString());
  const normalized = normalizeFacebookVersionDraft(input, allowedMediaIds);
  const videoThumbnailMediaId = await resolveFacebookThumbnailMediaId(
    media,
    version,
    normalized.videoThumbnailMediaId,
  );
  const now = new Date();

  return serializeDocument(
    await platformVersions.findOneAndUpdate(
      { _id: version._id, active: { $ne: false } },
      {
        $set: {
          message: normalized.message,
          destinationUrl: normalized.destinationUrl,
          mediaIds: normalized.mediaIds.map((id) => new ObjectId(id)),
          primaryMediaId: normalized.primaryMediaId
            ? new ObjectId(normalized.primaryMediaId)
            : null,
          videoThumbnailMediaId,
          customized: true,
          updatedAt: now,
        },
        $inc: { revision: 1 },
      },
      { returnDocument: "after" },
    ),
  );
}

export async function resetFacebookPlatformVersionFromMaster(versionId) {
  const { master, platformVersions, version } =
    await getEditableFacebookVersion(versionId);
  const inherited = buildInheritedFacebookFields({
    text: master.text,
    primaryUrl: master.primaryUrl,
    mediaIds: (master.mediaIds || []).map((id) => id.toString()),
    defaultPrimaryMediaId: master.defaultPrimaryMediaId?.toString() || "",
    defaultVideoThumbnailMediaId:
      master.defaultVideoThumbnailMediaId?.toString() || "",
    revision: master.revision,
  });
  const now = new Date();

  return serializeDocument(
    await platformVersions.findOneAndUpdate(
      { _id: version._id, active: { $ne: false } },
      {
        $set: {
          message: inherited.message,
          destinationUrl: inherited.destinationUrl,
          mediaIds: inherited.mediaIds.map((id) => new ObjectId(id)),
          primaryMediaId: inherited.primaryMediaId
            ? new ObjectId(inherited.primaryMediaId)
            : null,
          videoThumbnailMediaId: inherited.videoThumbnailMediaId
            ? new ObjectId(inherited.videoThumbnailMediaId)
            : null,
          masterRevisionSynced: inherited.masterRevisionSynced,
          customized: false,
          updatedAt: now,
        },
        $inc: { revision: 1 },
      },
      { returnDocument: "after" },
    ),
  );
}
