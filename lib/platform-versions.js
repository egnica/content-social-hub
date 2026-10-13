import "server-only";

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import {
  buildInheritedFacebookFields,
  buildInheritedInstagramFields,
  buildInheritedLinkedInFields,
  buildInheritedYouTubeFields,
  instagramMediaMode,
  isPublishableSocialConnection,
  normalizeFacebookVersionDraft,
  normalizeInstagramVersionDraft,
  normalizeLinkedInVersionDraft,
  normalizeYouTubeVersionDraft,
  validateYouTubeVersionDraft,
  validateLinkedInVersionDraft,
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
    selectable: isPublishableSocialConnection(connection, clientId),
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
        {
          clientId: master.clientId,
          platform: { $in: ["facebook", "instagram", "linkedin", "youtube"] },
        },
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
      .sort({ platform: 1, accountName: 1 })
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

function masterDefaults(master) {
  return {
    text: master.text,
    primaryUrl: master.primaryUrl,
    mediaIds: (master.mediaIds || []).map((id) => id.toString()),
    defaultPrimaryMediaId: master.defaultPrimaryMediaId?.toString() || "",
    defaultVideoThumbnailMediaId:
      master.defaultVideoThumbnailMediaId?.toString() || "",
    revision: master.revision,
    internalTitle: master.internalTitle,
  };
}

function instagramMediaViews(mediaDocuments) {
  return mediaDocuments.map((asset) => ({
    _id: asset._id.toString(),
    contentType: asset.contentType,
  }));
}

function instagramModeFromMediaDocuments(mediaDocuments, mediaIds) {
  return instagramMediaMode(instagramMediaViews(mediaDocuments), mediaIds);
}

function buildInstagramInheritedFields(master, mediaDocuments) {
  const inherited = buildInheritedInstagramFields(masterDefaults(master));
  const compatible = new Set(
    instagramMediaViews(mediaDocuments)
      .filter((asset) => {
        const type = String(asset.contentType || "");
        return type.startsWith("image/") || type.startsWith("video/");
      })
      .map((asset) => asset._id),
  );
  const mediaIds = inherited.mediaIds.filter((id) => compatible.has(id));
  const primaryMediaId = mediaIds.includes(inherited.primaryMediaId)
    ? inherited.primaryMediaId
    : mediaIds[0] || "";

  return {
    ...inherited,
    mediaIds,
    primaryMediaId,
    mediaMode: instagramModeFromMediaDocuments(mediaDocuments, mediaIds),
  };
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

  const { content, connections, media, platformVersions } =
    await platformCollections();
  const master = await content.findOne({ _id: masterContentId });

  if (!master) {
    throw new TypeError("Content not found.");
  }

  const selectedConnections = requestedObjectIds.length
    ? await connections
        .find({
          _id: { $in: requestedObjectIds },
          clientId: master.clientId,
          platform: { $in: ["facebook", "instagram", "linkedin", "youtube"] },
        })
        .toArray()
    : [];

  const eligibleConnections = selectedConnections.filter((connection) =>
    isPublishableSocialConnection(connection, master.clientId),
  );

  if (eligibleConnections.length !== requestedIds.length) {
    throw new TypeError(
      "One or more selected social destinations are unavailable, unhealthy, or belong to another client.",
    );
  }

  const [existingVersions, masterMediaDocuments] = await Promise.all([
    platformVersions.find({ masterContentId }).toArray(),
    (master.mediaIds || []).length
      ? media
          .find({
            _id: { $in: master.mediaIds || [] },
            clientId: master.clientId,
            status: "uploaded",
          })
          .project({ _id: 1, contentType: 1 })
          .toArray()
      : [],
  ]);
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
  const defaults = masterDefaults(master);
  const inheritedFacebook = buildInheritedFacebookFields(defaults);
  const inheritedLinkedIn = buildInheritedLinkedInFields({
    ...defaults, media: masterMediaDocuments.map((asset) =>
      ({ _id: String(asset._id), contentType: asset.contentType })),
  });
  const inheritedYouTube = buildInheritedYouTubeFields({ ...defaults, media: masterMediaDocuments.map((a) => ({ _id: String(a._id), contentType: a.contentType })) });
  const inheritedInstagram = buildInstagramInheritedFields(
    master,
    masterMediaDocuments,
  );

  for (const connectionId of plan.create) {
    const connection = connectionsById.get(connectionId);
    const socialConnectionId = new ObjectId(connectionId);
    const baseFields = {
      masterContentId,
      clientId: master.clientId,
      socialConnectionId,
      platform: connection.platform,
      providerAccountId: connection.providerAccountId,
      destinationName: connection.accountName,
      destinationPictureUrl: connection.pictureUrl || "",
      status: "draft",
      revision: 1,
      createdAt: now,
    };

    const providerFields =
      connection.platform === "youtube"
        ? { ...inheritedYouTube, mediaIds: inheritedYouTube.mediaIds.map((id) => new ObjectId(id)),
            primaryMediaId: inheritedYouTube.primaryMediaId ? new ObjectId(inheritedYouTube.primaryMediaId) : null,
            videoThumbnailMediaId: inheritedYouTube.videoThumbnailMediaId ? new ObjectId(inheritedYouTube.videoThumbnailMediaId) : null }
        : connection.platform === "linkedin"
        ? { message: inheritedLinkedIn.message,
            destinationUrl: inheritedLinkedIn.destinationUrl,
            mediaIds: inheritedLinkedIn.mediaIds.map((id) => new ObjectId(id)),
            primaryMediaId: inheritedLinkedIn.primaryMediaId ? new ObjectId(inheritedLinkedIn.primaryMediaId) : null,
            masterRevisionSynced: inheritedLinkedIn.masterRevisionSynced, customized: false }
        : connection.platform === "instagram"
        ? {
            caption: inheritedInstagram.caption,
            mediaIds: inheritedInstagram.mediaIds.map((id) => new ObjectId(id)),
            primaryMediaId: inheritedInstagram.primaryMediaId
              ? new ObjectId(inheritedInstagram.primaryMediaId)
              : null,
            videoThumbnailMediaId: inheritedInstagram.videoThumbnailMediaId
              ? new ObjectId(inheritedInstagram.videoThumbnailMediaId)
              : null,
            mediaMode: inheritedInstagram.mediaMode,
            masterRevisionSynced: inheritedInstagram.masterRevisionSynced,
            customized: false,
          }
        : {
            message: inheritedFacebook.message,
            destinationUrl: inheritedFacebook.destinationUrl,
            mediaIds: inheritedFacebook.mediaIds.map((id) => new ObjectId(id)),
            primaryMediaId: inheritedFacebook.primaryMediaId
              ? new ObjectId(inheritedFacebook.primaryMediaId)
              : null,
            videoThumbnailMediaId: inheritedFacebook.videoThumbnailMediaId
              ? new ObjectId(inheritedFacebook.videoThumbnailMediaId)
              : null,
            masterRevisionSynced: inheritedFacebook.masterRevisionSynced,
            customized: false,
          };

    await platformVersions.updateOne(
      { masterContentId, socialConnectionId },
      {
        $setOnInsert: {
          ...baseFields,
          ...providerFields,
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

async function getEditableVersion(versionId, platform) {
  const objectId = toObjectId(versionId);

  if (!objectId) {
    throw new TypeError(`${platform[0].toUpperCase() + platform.slice(1)} version not found.`);
  }

  const { content, connections, media, platformVersions } =
    await platformCollections();
  const version = await platformVersions.findOne({
    _id: objectId,
    platform,
    active: { $ne: false },
  });

  if (!version) {
    throw new TypeError(
      `${platform[0].toUpperCase() + platform.slice(1)} version not found or is currently excluded.`,
    );
  }

  const [master, connection] = await Promise.all([
    content.findOne({ _id: version.masterContentId }),
    connections.findOne({
      _id: version.socialConnectionId,
      clientId: version.clientId,
      platform,
    }),
  ]);

  if (!master || !connection || !master.clientId.equals(version.clientId)) {
    throw new TypeError(
      `${platform[0].toUpperCase() + platform.slice(1)} version is no longer connected to valid client content.`,
    );
  }

  return { master, connection, media, platformVersions, version };
}

async function getEditableFacebookVersion(versionId) {
  return getEditableVersion(versionId, "facebook");
}

async function getEditableInstagramVersion(versionId) {
  return getEditableVersion(versionId, "instagram");
}

async function getEditableLinkedInVersion(versionId) {
  return getEditableVersion(versionId, "linkedin");
}
async function linkedInMedia(media, master) {
  return (master.mediaIds || []).length
    ? media.find({ _id: { $in: master.mediaIds }, clientId: master.clientId, status: "uploaded" })
        .project({ _id: 1, contentType: 1 }).toArray()
    : [];
}
export async function saveLinkedInPlatformVersion(versionId, input) {
  const { master, media, platformVersions, version, connection } = await getEditableLinkedInVersion(versionId);
  if (!isPublishableSocialConnection(connection, master.clientId))
    throw new TypeError("LinkedIn profile is no longer healthy or authorized for this client.");
  const availableMedia = await linkedInMedia(media, master);
  const normalized = normalizeLinkedInVersionDraft(input, availableMedia);
  const validation = validateLinkedInVersionDraft({ ...normalized,
    media: availableMedia, healthStatus: connection.healthStatus,
    canPublish: connection.capabilities?.canPublish === true });
  if (validation.blocking.length) throw new TypeError(validation.blocking.join(" "));
  return serializeDocument(await platformVersions.findOneAndUpdate(
    { _id: version._id, platform: "linkedin", active: { $ne: false } },
    { $set: { message: normalized.message, destinationUrl: normalized.destinationUrl,
      mediaIds: normalized.mediaIds.map((id) => new ObjectId(id)),
      primaryMediaId: normalized.primaryMediaId ? new ObjectId(normalized.primaryMediaId) : null,
      customized: true, updatedAt: new Date() }, $inc: { revision: 1 } },
    { returnDocument: "after" }));
}
export async function resetLinkedInPlatformVersionFromMaster(versionId) {
  const { master, media, platformVersions, version, connection } = await getEditableLinkedInVersion(versionId);
  if (!isPublishableSocialConnection(connection, master.clientId))
    throw new TypeError("LinkedIn profile is no longer healthy or authorized for this client.");
  const documents = await linkedInMedia(media, master);
  const inherited = buildInheritedLinkedInFields({ ...masterDefaults(master),
    media: documents.map((asset) => ({ _id: String(asset._id), contentType: asset.contentType })) });
  return serializeDocument(await platformVersions.findOneAndUpdate(
    { _id: version._id, platform: "linkedin", active: { $ne: false } },
    { $set: { message: inherited.message, destinationUrl: inherited.destinationUrl,
      mediaIds: inherited.mediaIds.map((id) => new ObjectId(id)),
      primaryMediaId: inherited.primaryMediaId ? new ObjectId(inherited.primaryMediaId) : null,
      masterRevisionSynced: inherited.masterRevisionSynced, customized: false, updatedAt: new Date() },
      $inc: { revision: 1 } },
    { returnDocument: "after" }));
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

export async function saveInstagramPlatformVersion(versionId, input) {
  const { master, media, platformVersions, version } =
    await getEditableInstagramVersion(versionId);
  const allowedMediaIds = (master.mediaIds || []).map((id) => id.toString());
  const normalized = normalizeInstagramVersionDraft(input, allowedMediaIds);
  const selectedObjectIds = normalized.mediaIds.map((id) => new ObjectId(id));
  const selectedMedia = selectedObjectIds.length
    ? await media
        .find({
          _id: { $in: selectedObjectIds },
          clientId: version.clientId,
          status: "uploaded",
        })
        .project({ _id: 1, contentType: 1 })
        .toArray()
    : [];
  const mediaMode = instagramModeFromMediaDocuments(
    selectedMedia,
    normalized.mediaIds,
  );

  if (normalized.mediaIds.length && mediaMode === "incompatible") {
    throw new TypeError(
      "Every selected Instagram media item must be an attached image or video.",
    );
  }

  const now = new Date();

  return serializeDocument(
    await platformVersions.findOneAndUpdate(
      { _id: version._id, active: { $ne: false } },
      {
        $set: {
          caption: normalized.caption,
          mediaIds: selectedObjectIds,
          primaryMediaId: normalized.primaryMediaId
            ? new ObjectId(normalized.primaryMediaId)
            : null,
          mediaMode,
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
  const inherited = buildInheritedFacebookFields(masterDefaults(master));
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

export async function resetInstagramPlatformVersionFromMaster(versionId) {
  const { master, media, platformVersions, version } =
    await getEditableInstagramVersion(versionId);
  const requestedMediaIds = (master.mediaIds || []).map((id) => id.toString());
  const mediaDocuments = requestedMediaIds.length
    ? await media
        .find({
          _id: { $in: requestedMediaIds.map((id) => new ObjectId(id)) },
          clientId: version.clientId,
          status: "uploaded",
        })
        .project({ _id: 1, contentType: 1 })
        .toArray()
    : [];
  const inherited = buildInstagramInheritedFields(master, mediaDocuments);
  const now = new Date();

  return serializeDocument(
    await platformVersions.findOneAndUpdate(
      { _id: version._id, active: { $ne: false } },
      {
        $set: {
          caption: inherited.caption,
          mediaIds: inherited.mediaIds.map((id) => new ObjectId(id)),
          primaryMediaId: inherited.primaryMediaId
            ? new ObjectId(inherited.primaryMediaId)
            : null,
          videoThumbnailMediaId: inherited.videoThumbnailMediaId
            ? new ObjectId(inherited.videoThumbnailMediaId)
            : null,
          mediaMode: inherited.mediaMode,
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

async function getActiveVersionPlatform(versionId) {
  const objectId = toObjectId(versionId);
  if (!objectId) {
    throw new TypeError("Platform version not found.");
  }

  const { platformVersions } = await platformCollections();
  const version = await platformVersions.findOne(
    { _id: objectId, active: { $ne: false } },
    { projection: { platform: 1 } },
  );

  if (!version) {
    throw new TypeError("Platform version not found or is currently excluded.");
  }

  return version.platform;
}


async function youtubeMedia(media, master) {
  return (master.mediaIds || []).length
    ? media.find({ _id: { $in: master.mediaIds }, clientId: master.clientId, status: "uploaded" })
        .project({ _id: 1, contentType: 1 }).toArray()
    : [];
}
async function hydrateYouTubeVersion(version, media) {
  if (!version.videoThumbnailMediaId) return version;
  const thumbnail = await media.findOne({ _id: version.videoThumbnailMediaId, clientId: version.clientId, status: "uploaded", contentType: { $in: ["image/jpeg", "image/png"] } });
  return { ...version, videoThumbnail: thumbnail || null };
}
export async function saveYouTubePlatformVersion(versionId, input) {
  const { master, media, platformVersions, version, connection } = await getEditableVersion(versionId, "youtube");
  if (!isPublishableSocialConnection(connection, master.clientId))
    throw new TypeError("YouTube channel is not healthy or authorized for this client.");
  const normalized = normalizeYouTubeVersionDraft(input);
  const availableMedia = await youtubeMedia(media, master);
  const requestedThumbnailId = normalized.videoThumbnailMediaId ? toObjectId(normalized.videoThumbnailMediaId) : null;
  if (normalized.videoThumbnailMediaId && !requestedThumbnailId)
    throw new TypeError("Invalid YouTube thumbnail.");
  const thumbnail = requestedThumbnailId ? await media.findOne({
    _id: requestedThumbnailId, clientId: version.clientId, status: "uploaded",
    contentType: { $in: ["image/jpeg", "image/png"] },
  }) : null;
  const validation = validateYouTubeVersionDraft({ ...normalized, media: availableMedia,
    thumbnail: thumbnail ? { ...thumbnail, _id: String(thumbnail._id) } : null,
    healthStatus: connection.healthStatus, canPublish: connection.capabilities?.canPublish === true });
  if (validation.blocking.length) throw new TypeError(validation.blocking.join(" "));
  const saved = await platformVersions.findOneAndUpdate(
    { _id: version._id, platform: "youtube", active: { $ne: false } },
    { $set: { ...normalized, mediaIds: normalized.mediaIds.map((id) => new ObjectId(id)),
      primaryMediaId: new ObjectId(normalized.primaryMediaId), videoThumbnailMediaId: requestedThumbnailId,
      customized: true, updatedAt: new Date() }, $inc: { revision: 1 } },
    { returnDocument: "after" });
  return serializeDocument(await hydrateYouTubeVersion(saved, media));
}
export async function resetYouTubePlatformVersionFromMaster(versionId) {
  const { master, media, platformVersions, version, connection } = await getEditableVersion(versionId, "youtube");
  if (!isPublishableSocialConnection(connection, master.clientId))
    throw new TypeError("YouTube channel is not healthy or authorized for this client.");
  const availableMedia = await youtubeMedia(media, master);
  const inherited = buildInheritedYouTubeFields({ ...masterDefaults(master),
    media: availableMedia.map((a) => ({ _id: String(a._id), contentType: a.contentType })) });
  const saved = await platformVersions.findOneAndUpdate(
    { _id: version._id, platform: "youtube", active: { $ne: false } },
    { $set: { ...inherited, mediaIds: inherited.mediaIds.map((id) => new ObjectId(id)),
      primaryMediaId: inherited.primaryMediaId ? new ObjectId(inherited.primaryMediaId) : null,
      videoThumbnailMediaId: inherited.videoThumbnailMediaId ? new ObjectId(inherited.videoThumbnailMediaId) : null,
      updatedAt: new Date() }, $inc: { revision: 1 } },
    { returnDocument: "after" });
  return serializeDocument(await hydrateYouTubeVersion(saved, media));
}

export async function savePlatformVersion(versionId, input) {
  const platform = await getActiveVersionPlatform(versionId);

  if (platform === "facebook") {
    return saveFacebookPlatformVersion(versionId, input);
  }

  if (platform === "instagram") {
    return saveInstagramPlatformVersion(versionId, input);
  }
  if (platform === "linkedin") return saveLinkedInPlatformVersion(versionId, input);
  if (platform === "youtube") return saveYouTubePlatformVersion(versionId, input);

  throw new TypeError("This platform version is not editable yet.");
}

export async function resetPlatformVersionFromMaster(versionId) {
  const platform = await getActiveVersionPlatform(versionId);

  if (platform === "facebook") {
    return resetFacebookPlatformVersionFromMaster(versionId);
  }

  if (platform === "instagram") {
    return resetInstagramPlatformVersionFromMaster(versionId);
  }
  if (platform === "linkedin") return resetLinkedInPlatformVersionFromMaster(versionId);
  if (platform === "youtube") return resetYouTubePlatformVersionFromMaster(versionId);

  throw new TypeError("This platform version cannot be reset yet.");
}
