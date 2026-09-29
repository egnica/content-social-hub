import "server-only";

import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import {
  evaluateScheduleState,
  resolveScheduleRelease,
} from "@/lib/scheduling-logic";

let scheduleIndexesPromise;

async function scheduleCollections() {
  const db = await getDb();

  if (!scheduleIndexesPromise) {
    scheduleIndexesPromise = Promise.all([
      db.collection("scheduled_releases").createIndex(
        { platformVersionId: 1, platformVersionRevision: 1 },
        {
          unique: true,
          partialFilterExpression: { active: true },
          name: "one_active_schedule_per_destination_revision",
        },
      ),
      db.collection("scheduled_releases").createIndex({
        releaseAt: 1,
        state: 1,
      }),
      db.collection("scheduled_releases").createIndex({
        masterContentId: 1,
        updatedAt: -1,
      }),
      db.collection("scheduled_releases").createIndex({
        clientId: 1,
        releaseAt: 1,
      }),
    ]).catch((error) => {
      scheduleIndexesPromise = undefined;
      throw error;
    });
  }

  await scheduleIndexesPromise;

  return {
    clients: db.collection("clients"),
    connections: db.collection("social_connections"),
    content: db.collection("master_content"),
    platformVersions: db.collection("platform_versions"),
    schedules: db.collection("scheduled_releases"),
  };
}

function sameId(left, right) {
  return String(left || "") === String(right || "");
}

async function loadScheduleContext(platformVersionId) {
  const versionId = toObjectId(platformVersionId);
  if (!versionId) {
    throw new TypeError("Destination version not found.");
  }

  const { clients, connections, content, platformVersions, schedules } =
    await scheduleCollections();
  const version = await platformVersions.findOne({
    _id: versionId,
    active: { $ne: false },
  });

  if (!version) {
    throw new TypeError("Destination version not found or is currently excluded.");
  }

  const [master, client, connection] = await Promise.all([
    content.findOne({ _id: version.masterContentId }),
    clients.findOne({ _id: version.clientId }),
    connections.findOne({ _id: version.socialConnectionId }),
  ]);

  if (
    !master ||
    !client ||
    !connection ||
    !sameId(master.clientId, version.clientId) ||
    !sameId(connection.clientId, version.clientId) ||
    connection.platform !== version.platform
  ) {
    throw new TypeError(
      "This destination version is no longer connected to the correct client account.",
    );
  }

  return { client, connection, master, schedules, version };
}

function scheduleValidationMessage(code) {
  const messages = {
    no_release_time: "Choose a release date and time before scheduling.",
    invalid_release_time: "Choose a valid release date and time.",
    past_release_time: "Choose a future release date and time.",
    stale_content_revision:
      "This schedule targets an older content revision. Reschedule the current destination revision.",
    already_published_revision:
      "This destination revision has already been published and cannot be scheduled again.",
    cancelled: "This schedule has been cancelled.",
    superseded: "This schedule has been superseded by a newer schedule.",
  };

  return messages[code] || "This destination cannot be scheduled in its current state.";
}

export async function createDestinationSchedule({
  platformVersionId,
  releaseSource = "master",
  destinationLocalDateTime = "",
  now = new Date(),
} = {}) {
  const { client, connection, master, schedules, version } =
    await loadScheduleContext(platformVersionId);
  const resolved = resolveScheduleRelease({
    source: releaseSource,
    masterReleaseAt: master.defaultReleaseAt,
    masterReleaseTimezone: master.defaultReleaseTimezone,
    destinationLocalDateTime,
    clientTimezone: client.timezone,
  });

  if (!resolved.ok) {
    throw new TypeError(resolved.error);
  }

  const scheduleState = evaluateScheduleState({
    releaseAt: resolved.releaseAt,
    now,
    platformVersionRevision: version.revision,
    currentPlatformVersionRevision: version.revision,
    publishedRevision: version.publishedRevision,
  });

  if (!scheduleState.valid) {
    throw new TypeError(scheduleValidationMessage(scheduleState.code));
  }

  const createdAt = new Date();
  const document = {
    masterContentId: master._id,
    clientId: client._id,
    platformVersionId: version._id,
    platformVersionRevision: Number(version.revision || 1),
    socialConnectionId: connection._id,
    providerAccountId: connection.providerAccountId || version.providerAccountId || "",
    platform: version.platform,
    releaseAt: resolved.releaseAt,
    timezone: resolved.timezone,
    releaseSource: resolved.source,
    destinationLocalDateTime:
      resolved.source === "destination_override" ? resolved.localDateTime : null,
    state: "scheduled",
    active: true,
    awsScheduleId: null,
    dispatchedAt: null,
    cancelledAt: null,
    supersededAt: null,
    completedAt: null,
    missedReason: null,
    failure: null,
    createdAt,
    updatedAt: createdAt,
  };

  try {
    const result = await schedules.insertOne(document);
    return serializeDocument({ ...document, _id: result.insertedId });
  } catch (error) {
    if (error?.code === 11000) {
      throw new TypeError(
        "This destination revision already has an active schedule. Reschedule or cancel it instead of creating a duplicate.",
      );
    }
    throw error;
  }
}

export async function getActiveScheduleForDestination(
  platformVersionId,
  platformVersionRevision = null,
) {
  const versionId = toObjectId(platformVersionId);
  if (!versionId) return null;

  const { schedules } = await scheduleCollections();
  const query = {
    platformVersionId: versionId,
    active: true,
  };

  if (
    platformVersionRevision !== null &&
    platformVersionRevision !== undefined &&
    Number.isInteger(Number(platformVersionRevision))
  ) {
    query.platformVersionRevision = Number(platformVersionRevision);
  }

  return serializeDocument(
    await schedules.findOne(query, { sort: { createdAt: -1 } }),
  );
}

export async function getScheduleById(scheduleId) {
  const objectId = toObjectId(scheduleId);
  if (!objectId) return null;

  const { schedules } = await scheduleCollections();
  return serializeDocument(await schedules.findOne({ _id: objectId }));
}
