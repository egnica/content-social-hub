import "server-only";

import { validateFacebookPublishDraft } from "@/lib/facebook-publish-logic";
import { validateInstagramL505PublishDraft } from "@/lib/instagram-carousel-publish-logic";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import {
  evaluateScheduleState,
  formatUtcDateTimeForZone,
  isScheduleMutable,
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
    media: db.collection("media_assets"),
    platformVersions: db.collection("platform_versions"),
    schedules: db.collection("scheduled_releases"),
  };
}

function sameId(left, right) {
  return String(left || "") === String(right || "");
}

function mediaView(asset) {
  return {
    _id: asset?._id?.toString?.() || String(asset?._id || ""),
    contentType: asset?.contentType || "",
    size: Number(asset?.size || 0),
    width: Number(asset?.width || 0),
    height: Number(asset?.height || 0),
    duration: Number(asset?.duration || 0),
    aspectRatio: Number(asset?.aspectRatio || 0),
    originalName: asset?.originalName || "",
  };
}

async function loadScheduleContext(platformVersionId) {
  const versionId = toObjectId(platformVersionId);
  if (!versionId) {
    throw new TypeError("Destination version not found.");
  }

  const {
    clients,
    connections,
    content,
    media,
    platformVersions,
    schedules,
  } = await scheduleCollections();
  const version = await platformVersions.findOne({
    _id: versionId,
    platform: { $in: ["facebook", "instagram"] },
    active: { $ne: false },
  });

  if (!version) {
    throw new TypeError(
      "Destination version not found, unsupported, or currently excluded.",
    );
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

  return {
    client,
    connection,
    master,
    media,
    schedules,
    version,
  };
}

async function validateDestinationForScheduling({
  connection,
  master,
  media,
  version,
}) {
  const selectedMediaIds = Array.isArray(version.mediaIds) ? version.mediaIds : [];
  const requestedMediaIds = [...selectedMediaIds];

  if (
    version.videoThumbnailMediaId &&
    !requestedMediaIds.some((id) => id.equals(version.videoThumbnailMediaId))
  ) {
    requestedMediaIds.push(version.videoThumbnailMediaId);
  }

  const mediaDocuments = requestedMediaIds.length
    ? await media
        .find({
          _id: { $in: requestedMediaIds },
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
  const videoThumbnailAsset = version.videoThumbnailMediaId
    ? mediaById.get(version.videoThumbnailMediaId.toString()) || null
    : null;

  const common = {
    mediaIds: selectedMediaIds.map((id) => id.toString()),
    mediaAssets: orderedMedia.map(mediaView),
    healthStatus: connection.healthStatus,
    canPublish: connection.capabilities?.canPublish === true,
  };

  if (version.platform === "instagram") {
    return validateInstagramL505PublishDraft({
      ...common,
      caption: version.caption,
    });
  }

  return validateFacebookPublishDraft({
    ...common,
    message: version.message,
    destinationUrl: version.destinationUrl,
    videoThumbnailMediaId: version.videoThumbnailMediaId?.toString() || "",
    videoThumbnailAsset: videoThumbnailAsset
      ? mediaView(videoThumbnailAsset)
      : null,
    masterChanged:
      Number(version.masterRevisionSynced || 0) !== Number(master.revision || 0),
    customized: version.customized === true,
  });
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

  return (
    messages[code] || "This destination cannot be scheduled in its current state."
  );
}

function buildScheduleDocument({
  client,
  connection,
  master,
  resolved,
  version,
  createdAt,
  supersedesScheduleId = null,
}) {
  return {
    masterContentId: master._id,
    clientId: client._id,
    platformVersionId: version._id,
    platformVersionRevision: Number(version.revision || 1),
    socialConnectionId: connection._id,
    providerAccountId:
      connection.providerAccountId || version.providerAccountId || "",
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
    supersedesScheduleId,
    supersededByScheduleId: null,
    completedAt: null,
    missedReason: null,
    failure: null,
    createdAt,
    updatedAt: createdAt,
  };
}

async function resolveAndValidateNewSchedule({
  client,
  connection,
  master,
  media,
  version,
  releaseSource,
  destinationLocalDateTime,
  now,
}) {
  const validation = await validateDestinationForScheduling({
    connection,
    master,
    media,
    version,
  });

  if (!validation.publishable) {
    throw new TypeError(validation.blocking.join(" "));
  }

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

  return { resolved, validation };
}

function scheduleView(schedule) {
  if (!schedule) return null;

  return serializeDocument({
    ...schedule,
    localDateTime: schedule.releaseAt
      ? formatUtcDateTimeForZone(schedule.releaseAt, schedule.timezone)
      : schedule.destinationLocalDateTime || "",
  });
}

function masterDefaultView(master, client) {
  const resolved = resolveScheduleRelease({
    source: "master",
    masterReleaseAt: master.defaultReleaseAt,
    masterReleaseTimezone: master.defaultReleaseTimezone,
    clientTimezone: client.timezone,
  });

  if (!resolved.ok) {
    return {
      available: false,
      code: resolved.code,
      error: resolved.error,
      timezone: String(client.timezone || ""),
    };
  }

  return {
    available: true,
    releaseAt: resolved.releaseAtIso,
    localDateTime: resolved.localDateTime,
    timezone: resolved.timezone,
  };
}

export async function createDestinationSchedule({
  platformVersionId,
  releaseSource = "master",
  destinationLocalDateTime = "",
  now = new Date(),
} = {}) {
  const context = await loadScheduleContext(platformVersionId);
  const { client, connection, master, media, schedules, version } = context;
  const activeSchedule = await schedules.findOne({
    platformVersionId: version._id,
    active: true,
  });

  if (activeSchedule) {
    throw new TypeError(
      "This destination already has an active schedule. Reschedule or cancel it instead of creating another one.",
    );
  }

  const { resolved } = await resolveAndValidateNewSchedule({
    client,
    connection,
    master,
    media,
    version,
    releaseSource,
    destinationLocalDateTime,
    now,
  });
  const createdAt = new Date();
  const document = buildScheduleDocument({
    client,
    connection,
    master,
    resolved,
    version,
    createdAt,
  });

  try {
    const result = await schedules.insertOne(document);
    return scheduleView({ ...document, _id: result.insertedId });
  } catch (error) {
    if (error?.code === 11000) {
      throw new TypeError(
        "This destination revision already has an active schedule. Reschedule or cancel it instead of creating a duplicate.",
      );
    }
    throw error;
  }
}

export async function rescheduleDestinationSchedule({
  platformVersionId,
  scheduleId,
  releaseSource = "master",
  destinationLocalDateTime = "",
  now = new Date(),
} = {}) {
  const scheduleObjectId = toObjectId(scheduleId);
  if (!scheduleObjectId) {
    throw new TypeError("Scheduled release not found.");
  }

  const context = await loadScheduleContext(platformVersionId);
  const { client, connection, master, media, schedules, version } = context;
  const currentSchedule = await schedules.findOne({
    _id: scheduleObjectId,
    platformVersionId: version._id,
    active: true,
  });

  if (!currentSchedule) {
    throw new TypeError(
      "The active scheduled release could not be found. Refresh and try again.",
    );
  }

  if (!isScheduleMutable(currentSchedule)) {
    throw new TypeError(
      "This scheduled release can no longer be changed because dispatch has already begun.",
    );
  }

  const { resolved } = await resolveAndValidateNewSchedule({
    client,
    connection,
    master,
    media,
    version,
    releaseSource,
    destinationLocalDateTime,
    now,
  });
  const transitionAt = new Date();
  const supersededSchedule = await schedules.findOneAndUpdate(
    {
      _id: currentSchedule._id,
      platformVersionId: version._id,
      active: true,
      state: "scheduled",
      dispatchedAt: null,
    },
    {
      $set: {
        state: "superseded",
        active: false,
        supersededAt: transitionAt,
        updatedAt: transitionAt,
      },
    },
    { returnDocument: "after" },
  );

  if (!supersededSchedule) {
    throw new TypeError(
      "This scheduled release changed before it could be rescheduled. Refresh and try again.",
    );
  }

  const document = buildScheduleDocument({
    client,
    connection,
    master,
    resolved,
    version,
    createdAt: transitionAt,
    supersedesScheduleId: currentSchedule._id,
  });

  try {
    const result = await schedules.insertOne(document);
    await schedules.updateOne(
      { _id: currentSchedule._id, state: "superseded", active: false },
      {
        $set: {
          supersededByScheduleId: result.insertedId,
          updatedAt: new Date(),
        },
      },
    );

    return scheduleView({ ...document, _id: result.insertedId });
  } catch (error) {
    await schedules
      .updateOne(
        {
          _id: currentSchedule._id,
          state: "superseded",
          active: false,
          updatedAt: transitionAt,
        },
        {
          $set: {
            state: "scheduled",
            active: true,
            supersededAt: null,
            updatedAt: new Date(),
          },
        },
      )
      .catch(() => {});

    if (error?.code === 11000) {
      throw new TypeError(
        "The current destination revision already has another active schedule. Refresh before trying again.",
      );
    }

    throw error;
  }
}

export async function cancelDestinationSchedule({
  platformVersionId,
  scheduleId,
} = {}) {
  const scheduleObjectId = toObjectId(scheduleId);
  if (!scheduleObjectId) {
    throw new TypeError("Scheduled release not found.");
  }

  const { schedules, version } = await loadScheduleContext(platformVersionId);
  const cancelledAt = new Date();
  const cancelled = await schedules.findOneAndUpdate(
    {
      _id: scheduleObjectId,
      platformVersionId: version._id,
      active: true,
      state: "scheduled",
      dispatchedAt: null,
    },
    {
      $set: {
        state: "cancelled",
        active: false,
        cancelledAt,
        updatedAt: cancelledAt,
      },
    },
    { returnDocument: "after" },
  );

  if (cancelled) {
    return scheduleView(cancelled);
  }

  const existing = await schedules.findOne({
    _id: scheduleObjectId,
    platformVersionId: version._id,
  });

  if (!existing) {
    throw new TypeError("Scheduled release not found.");
  }

  if (existing.dispatchedAt || existing.state === "dispatching") {
    throw new TypeError(
      "This scheduled release cannot be cancelled because dispatch has already begun.",
    );
  }

  throw new TypeError("This scheduled release is no longer active.");
}

export async function getDestinationScheduleState(
  platformVersionId,
  { now = new Date() } = {},
) {
  const context = await loadScheduleContext(platformVersionId);
  const { client, connection, master, media, schedules, version } = context;
  const activeSchedule = await schedules.findOne(
    { platformVersionId: version._id, active: true },
    { sort: { updatedAt: -1 } },
  );
  const latestSchedule =
    activeSchedule ||
    (await schedules.findOne(
      { platformVersionId: version._id },
      { sort: { updatedAt: -1 } },
    ));
  const currentRevision = Number(version.revision || 1);
  const publishedRevision = Number(version.publishedRevision || 0);
  const currentRevisionPublished = publishedRevision === currentRevision;
  let validation;

  try {
    validation = await validateDestinationForScheduling({
      connection,
      master,
      media,
      version,
    });
  } catch (error) {
    validation = {
      publishable: false,
      blocking: [error.message || "This destination cannot be scheduled."],
      warnings: [],
    };
  }

  const stateEvaluation = latestSchedule
    ? evaluateScheduleState({
        releaseAt: latestSchedule.releaseAt,
        now,
        state: latestSchedule.state,
        active: latestSchedule.active === true,
        platformVersionRevision: latestSchedule.platformVersionRevision,
        currentPlatformVersionRevision: currentRevision,
        publishedRevision,
      })
    : currentRevisionPublished
      ? { code: "already_published_revision", valid: false }
      : { code: "ready", valid: true };
  const mutable = isScheduleMutable(activeSchedule);

  return {
    platformVersionId: version._id.toString(),
    platformVersionRevision: currentRevision,
    publishedRevision,
    currentRevisionPublished,
    clientTimezone: String(client.timezone || ""),
    masterDefault: masterDefaultView(master, client),
    schedule: scheduleView(latestSchedule),
    activeScheduleId: activeSchedule?._id?.toString() || null,
    stateCode: stateEvaluation.code,
    stale: stateEvaluation.code === "stale_content_revision",
    validation: {
      publishable: validation.publishable === true,
      blocking: Array.isArray(validation.blocking) ? validation.blocking : [],
      warnings: Array.isArray(validation.warnings) ? validation.warnings : [],
    },
    canSchedule:
      !activeSchedule &&
      !currentRevisionPublished &&
      validation.publishable === true,
    canReschedule:
      mutable && !currentRevisionPublished && validation.publishable === true,
    canCancel: mutable,
  };
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

  return scheduleView(
    await schedules.findOne(query, { sort: { createdAt: -1 } }),
  );
}

export async function getScheduleById(scheduleId) {
  const objectId = toObjectId(scheduleId);
  if (!objectId) return null;

  const { schedules } = await scheduleCollections();
  return scheduleView(await schedules.findOne({ _id: objectId }));
}
