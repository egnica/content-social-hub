import "server-only";

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import {
  buildInheritedFacebookFields,
  isPublishableFacebookConnection,
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

export async function getPlatformDestinationState(contentId) {
  const masterContentId = toObjectId(contentId);

  if (!masterContentId) return null;

  const { content, connections, platformVersions } = await platformCollections();
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

  return serializeDocument({
    destinations: connectionDocuments.map((connection) =>
      connectionView(connection, master.clientId),
    ),
    platformVersions: versionDocuments,
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
