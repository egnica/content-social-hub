import "server-only";

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";

let indexesPromise;

async function ensureIndexes(db) {
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      db.collection("clients").createIndex({ name: 1 }),
      db.collection("clients").createIndex({ status: 1, updatedAt: -1 }),
      db.collection("master_content").createIndex({ clientId: 1, updatedAt: -1 }),
      db.collection("master_content").createIndex({ status: 1, updatedAt: -1 }),
      db.collection("master_content").createIndex({ reusable: 1, updatedAt: -1 }),
      db.collection("media_assets").createIndex({ clientId: 1, createdAt: -1 }),
      db.collection("media_assets").createIndex({ objectKey: 1 }, { unique: true }),
    ]).catch((error) => {
      indexesPromise = undefined;
      throw error;
    });
  }

  await indexesPromise;
}

async function collections() {
  const db = await getDb();
  await ensureIndexes(db);

  return {
    db,
    clients: db.collection("clients"),
    content: db.collection("master_content"),
    media: db.collection("media_assets"),
    connections: db.collection("social_connections"),
  };
}

export async function listClients({ includeInactive = true } = {}) {
  const { clients } = await collections();
  const query = includeInactive ? {} : { status: "active" };
  const documents = await clients.find(query).sort({ name: 1 }).toArray();

  return serializeDocument(documents);
}

export async function getClientById(id) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return null;
  }

  const { clients } = await collections();
  return serializeDocument(await clients.findOne({ _id: objectId }));
}

export async function createClient(input) {
  const { clients } = await collections();
  const now = new Date();
  const document = {
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const result = await clients.insertOne(document);

  return serializeDocument({ ...document, _id: result.insertedId });
}

export async function updateClient(id, input) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return null;
  }

  const { clients } = await collections();
  return serializeDocument(
    await clients.findOneAndUpdate(
      { _id: objectId },
      { $set: { ...input, updatedAt: new Date() } },
      { returnDocument: "after" },
    ),
  );
}

export async function deleteClientIfEmpty(id) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return { status: "not_found" };
  }

  const { clients, content, connections } = await collections();
  const client = await clients.findOne({ _id: objectId });

  if (!client) {
    return { status: "not_found" };
  }

  const [contentCount, connectionCount] = await Promise.all([
    content.countDocuments({ clientId: objectId }),
    connections.countDocuments({ clientId: objectId }),
  ]);

  if (contentCount > 0) {
    return { status: "has_content", contentCount };
  }

  if (connectionCount > 0) {
    return { status: "has_connections", connectionCount };
  }

  await clients.deleteOne({ _id: objectId });

  return { status: "deleted", client: serializeDocument(client) };
}

export async function listContent({ clientId = "", reusable = false } = {}) {
  const { clients, content } = await collections();
  const query = {};
  const clientObjectId = toObjectId(clientId);

  if (clientObjectId) {
    query.clientId = clientObjectId;
  }

  if (reusable) {
    query.reusable = true;
  }

  const [documents, clientDocuments] = await Promise.all([
    content.find(query).sort({ updatedAt: -1 }).limit(250).toArray(),
    clients.find({}).project({ name: 1 }).toArray(),
  ]);
  const clientNames = new Map(
    clientDocuments.map((client) => [client._id.toString(), client.name]),
  );

  return serializeDocument(
    documents.map((document) => ({
      ...document,
      clientName: clientNames.get(document.clientId?.toString()) || "Unknown client",
    })),
  );
}

export async function getContentById(id) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return null;
  }

  const { clients, content, media } = await collections();
  const document = await content.findOne({ _id: objectId });

  if (!document) {
    return null;
  }

  const [client, mediaDocuments] = await Promise.all([
    clients.findOne({ _id: document.clientId }, { projection: { name: 1 } }),
    media
      .find({ _id: { $in: document.mediaIds || [] }, status: "uploaded" })
      .sort({ createdAt: 1 })
      .toArray(),
  ]);
  const mediaById = new Map(
    mediaDocuments.map((asset) => [asset._id.toString(), asset]),
  );
  const orderedMedia = (document.mediaIds || [])
    .map((mediaId) => mediaById.get(mediaId.toString()))
    .filter(Boolean);

  return serializeDocument({
    ...document,
    clientName: client?.name || "Unknown client",
    media: orderedMedia,
  });
}

function normalizeContentDocument(input) {
  const mediaIds = input.mediaIds
    .map((id) => toObjectId(id))
    .filter(Boolean);
  const defaultPrimaryMediaId = toObjectId(input.defaultPrimaryMediaId);
  const defaultReleaseAt = input.defaultReleaseAt
    ? new Date(input.defaultReleaseAt)
    : null;

  return {
    internalTitle: input.internalTitle,
    clientId: new ObjectId(input.clientId),
    text: input.text,
    primaryUrl: input.primaryUrl,
    contentLength: input.contentLength,
    reusable: input.reusable,
    mediaIds,
    defaultPrimaryMediaId:
      defaultPrimaryMediaId &&
      mediaIds.some((id) => id.equals(defaultPrimaryMediaId))
        ? defaultPrimaryMediaId
        : null,
    defaultReleaseAt:
      defaultReleaseAt && !Number.isNaN(defaultReleaseAt.getTime())
        ? defaultReleaseAt
        : null,
    status: "saved",
  };
}

export async function createContent(input) {
  const { clients, content, media } = await collections();
  const clientId = toObjectId(input.clientId);

  if (!clientId || !(await clients.findOne({ _id: clientId }))) {
    throw new TypeError("Choose a valid client.");
  }

  const normalized = normalizeContentDocument(input);
  const validMedia = await media
    .find({
      _id: { $in: normalized.mediaIds },
      clientId,
      status: "uploaded",
    })
    .project({ _id: 1 })
    .toArray();
  normalized.mediaIds = validMedia.map((asset) => asset._id);

  if (
    normalized.defaultPrimaryMediaId &&
    !normalized.mediaIds.some((id) => id.equals(normalized.defaultPrimaryMediaId))
  ) {
    normalized.defaultPrimaryMediaId = null;
  }

  const now = new Date();
  const document = {
    ...normalized,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
  const result = await content.insertOne(document);

  return serializeDocument({ ...document, _id: result.insertedId });
}

export async function updateContent(id, input) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return null;
  }

  const { clients, content, media } = await collections();
  const existing = await content.findOne({ _id: objectId });
  const clientId = toObjectId(input.clientId);

  if (!existing || !clientId || !(await clients.findOne({ _id: clientId }))) {
    return null;
  }

  const normalized = normalizeContentDocument(input);
  const validMedia = await media
    .find({
      _id: { $in: normalized.mediaIds },
      clientId,
      status: "uploaded",
    })
    .project({ _id: 1 })
    .toArray();
  normalized.mediaIds = validMedia.map((asset) => asset._id);

  if (
    normalized.defaultPrimaryMediaId &&
    !normalized.mediaIds.some((mediaId) =>
      mediaId.equals(normalized.defaultPrimaryMediaId),
    )
  ) {
    normalized.defaultPrimaryMediaId = null;
  }

  return serializeDocument(
    await content.findOneAndUpdate(
      { _id: objectId },
      {
        $set: { ...normalized, updatedAt: new Date() },
        $inc: { revision: 1 },
      },
      { returnDocument: "after" },
    ),
  );
}

export async function deleteContent(id) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return null;
  }

  const { content } = await collections();
  return serializeDocument(await content.findOneAndDelete({ _id: objectId }));
}

export async function createPendingMedia(input) {
  const { clients, media } = await collections();
  const clientId = toObjectId(input.clientId);

  if (!clientId || !(await clients.findOne({ _id: clientId }))) {
    throw new TypeError("Choose a valid client before uploading media.");
  }

  const document = {
    clientId,
    objectKey: input.objectKey,
    originalName: input.originalName,
    contentType: input.contentType,
    size: input.size,
    width: input.width || null,
    height: input.height || null,
    duration: input.duration || null,
    aspectRatio: input.aspectRatio || null,
    orientation: input.orientation || null,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await media.insertOne(document);

  return serializeDocument({ ...document, _id: result.insertedId });
}

export async function completeMediaUpload(id) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return null;
  }

  const { media } = await collections();
  return serializeDocument(
    await media.findOneAndUpdate(
      { _id: objectId, status: "pending" },
      { $set: { status: "uploaded", updatedAt: new Date() } },
      { returnDocument: "after" },
    ),
  );
}

export async function getMediaById(id) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return null;
  }

  const { media } = await collections();
  return serializeDocument(
    await media.findOne({ _id: objectId, status: "uploaded" }),
  );
}

export async function getPendingMediaById(id) {
  const objectId = toObjectId(id);

  if (!objectId) {
    return null;
  }

  const { media } = await collections();
  return serializeDocument(
    await media.findOne({ _id: objectId, status: "pending" }),
  );
}

export async function getDashboardData() {
  const { clients, content, media, connections } = await collections();
  const [
    activeClients,
    savedContent,
    reusableContent,
    uploadedMedia,
    connectedAccounts,
    connectionProblems,
    recentContent,
  ] = await Promise.all([
    clients.countDocuments({ status: "active" }),
    content.countDocuments({}),
    content.countDocuments({ reusable: true }),
    media.countDocuments({ status: "uploaded" }),
    connections.countDocuments({}),
    connections.countDocuments({ healthStatus: { $ne: "healthy" } }),
    listContent(),
  ]);

  return {
    activeClients,
    savedContent,
    reusableContent,
    uploadedMedia,
    connectedAccounts,
    connectionProblems,
    recentContent: recentContent.slice(0, 6),
  };
}
