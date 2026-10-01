export function uniqueStringIds(values) {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ];
}

export function isPublishableFacebookConnection(connection, clientId) {
  if (!connection || !clientId) return false;

  return (
    String(connection.clientId || "") === String(clientId) &&
    connection.platform === "facebook" &&
    connection.healthStatus === "healthy" &&
    connection.capabilities?.canPublish === true
  );
}

export function isPublishableInstagramConnection(connection, clientId) {
  if (!connection || !clientId) return false;

  return (
    String(connection.clientId || "") === String(clientId) &&
    connection.platform === "instagram" &&
    connection.healthStatus === "healthy" &&
    connection.capabilities?.canPublish === true
  );
}

export function isPublishableSocialConnection(connection, clientId) {
  if (connection?.platform === "facebook") {
    return isPublishableFacebookConnection(connection, clientId);
  }

  if (connection?.platform === "instagram") {
    return isPublishableInstagramConnection(connection, clientId);
  }

  return false;
}

function inheritedMediaFields(content) {
  const mediaIds = uniqueStringIds(content?.mediaIds || []);
  const requestedPrimary = String(content?.defaultPrimaryMediaId || "").trim();
  const primaryMediaId = mediaIds.includes(requestedPrimary)
    ? requestedPrimary
    : mediaIds[0] || "";

  return { mediaIds, primaryMediaId };
}

export function buildInheritedFacebookFields(content) {
  const { mediaIds, primaryMediaId } = inheritedMediaFields(content);

  return {
    message: typeof content?.text === "string" ? content.text : "",
    destinationUrl:
      typeof content?.primaryUrl === "string" ? content.primaryUrl : "",
    mediaIds,
    primaryMediaId,
    videoThumbnailMediaId: String(
      content?.defaultVideoThumbnailMediaId || "",
    ).trim(),
    masterRevisionSynced: Number.isInteger(content?.revision)
      ? content.revision
      : 1,
    customized: false,
  };
}

export function buildInheritedInstagramFields(content) {
  const { mediaIds, primaryMediaId } = inheritedMediaFields(content);

  return {
    caption: typeof content?.text === "string" ? content.text : "",
    mediaIds,
    primaryMediaId,
    masterRevisionSynced: Number.isInteger(content?.revision)
      ? content.revision
      : 1,
    customized: false,
  };
}

export function isFacebookVersionOutOfSync(version, masterRevision) {
  const syncedRevision = Number(version?.masterRevisionSynced || 0);
  const currentRevision = Number(masterRevision || 0);

  return syncedRevision !== currentRevision;
}

export function isInstagramVersionOutOfSync(version, masterRevision) {
  const syncedRevision = Number(version?.masterRevisionSynced || 0);
  const currentRevision = Number(masterRevision || 0);

  return syncedRevision !== currentRevision;
}

export function normalizeFacebookVersionDraft(input, allowedMediaIds = []) {
  const allowed = new Set(uniqueStringIds(allowedMediaIds));
  const mediaIds = uniqueStringIds(input?.mediaIds || []).filter((id) =>
    allowed.has(id),
  );
  const requestedPrimary = String(input?.primaryMediaId || "").trim();

  return {
    message: typeof input?.message === "string" ? input.message : "",
    destinationUrl:
      typeof input?.destinationUrl === "string" ? input.destinationUrl : "",
    mediaIds,
    primaryMediaId: mediaIds.includes(requestedPrimary)
      ? requestedPrimary
      : mediaIds[0] || "",
    videoThumbnailMediaId: String(input?.videoThumbnailMediaId || "").trim(),
  };
}

export function normalizeInstagramVersionDraft(input, allowedMediaIds = []) {
  const allowed = new Set(uniqueStringIds(allowedMediaIds));
  const mediaIds = uniqueStringIds(input?.mediaIds || []).filter((id) =>
    allowed.has(id),
  );
  const requestedPrimary = String(input?.primaryMediaId || "").trim();

  return {
    caption: typeof input?.caption === "string" ? input.caption : "",
    mediaIds,
    primaryMediaId: mediaIds.includes(requestedPrimary)
      ? requestedPrimary
      : mediaIds[0] || "",
  };
}

function validHttpUrl(value) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function instagramMediaMode(media = [], mediaIds = []) {
  const selected = new Set(uniqueStringIds(mediaIds));
  const selectedMedia = media.filter((asset) =>
    selected.has(String(asset?._id || "")),
  );

  if (!selectedMedia.length || selectedMedia.length !== selected.size) {
    return "incompatible";
  }

  const supported = selectedMedia.every((asset) => {
    const type = String(asset?.contentType || "");
    return type.startsWith("image/") || type.startsWith("video/");
  });

  if (!supported) return "incompatible";

  if (selectedMedia.length === 1) {
    return String(selectedMedia[0]?.contentType || "").startsWith("video/")
      ? "reel"
      : "single_image";
  }

  return "carousel";
}

export function instagramMediaModeLabel(mode) {
  if (mode === "single_image") return "Single image";
  if (mode === "carousel") return "Carousel";
  if (mode === "reel") return "Reel / video";
  return "Incompatible";
}

export function validateFacebookVersionDraft({
  message = "",
  destinationUrl = "",
  mediaIds = [],
  healthStatus = "healthy",
  canPublish = true,
  masterChanged = false,
  customized = false,
} = {}) {
  const blocking = [];
  const warnings = [];
  const hasContent =
    Boolean(String(message).trim()) ||
    Boolean(String(destinationUrl).trim()) ||
    uniqueStringIds(mediaIds).length > 0;

  if (healthStatus !== "healthy" || canPublish !== true) {
    blocking.push(
      "The Facebook destination is not currently healthy and publishable.",
    );
  }

  if (!hasContent) {
    blocking.push("Add a message, destination URL, or media before publishing.");
  }

  if (destinationUrl && !validHttpUrl(destinationUrl)) {
    blocking.push("Use a valid http or https destination URL.");
  }

  if (masterChanged) {
    warnings.push(
      customized
        ? "Master content changed. Your Facebook-specific edits are preserved until you reset from Master."
        : "Master content changed. Update this Facebook version from Master before publishing.",
    );
  }

  return {
    blocking,
    warnings,
    publishable: blocking.length === 0,
  };
}

export function validateInstagramVersionDraft({
  caption = "",
  mediaIds = [],
  media = [],
  healthStatus = "healthy",
  canPublish = true,
  masterChanged = false,
  customized = false,
} = {}) {
  const blocking = [];
  const warnings = [];
  const mode = instagramMediaMode(media, mediaIds);

  if (healthStatus !== "healthy" || canPublish !== true) {
    blocking.push(
      "The Instagram destination is not currently healthy and publishable.",
    );
  }

  if (!uniqueStringIds(mediaIds).length) {
    blocking.push(
      "Instagram requires at least one compatible image or video. Text-only and URL-only content cannot be published to Instagram.",
    );
  } else if (mode === "incompatible") {
    blocking.push(
      "Every selected Instagram media item must be an attached image or video.",
    );
  }

  if (masterChanged) {
    warnings.push(
      customized
        ? "Master content changed. Your Instagram-specific edits are preserved until you reset from Master."
        : "Master content changed. Update this Instagram version from Master before publishing.",
    );
  }

  return {
    blocking,
    warnings,
    publishable: blocking.length === 0,
    mediaMode: mode,
  };
}

export function planPlatformVersionSelection({
  existingVersions = [],
  selectedConnectionIds = [],
}) {
  const selected = new Set(uniqueStringIds(selectedConnectionIds));
  const existingByConnection = new Map(
    existingVersions
      .filter((version) => version?.socialConnectionId)
      .map((version) => [String(version.socialConnectionId), version]),
  );

  const create = [];
  const reactivate = [];
  const keep = [];
  const exclude = [];

  for (const connectionId of selected) {
    const version = existingByConnection.get(connectionId);

    if (!version) {
      create.push(connectionId);
    } else if (version.active === false) {
      reactivate.push(connectionId);
    } else {
      keep.push(connectionId);
    }
  }

  for (const [connectionId, version] of existingByConnection) {
    if (version.active !== false && !selected.has(connectionId)) {
      exclude.push(connectionId);
    }
  }

  return { create, reactivate, keep, exclude };
}
