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

export function buildInheritedFacebookFields(content) {
  const mediaIds = uniqueStringIds(content?.mediaIds || []);
  const requestedPrimary = String(content?.defaultPrimaryMediaId || "").trim();
  const primaryMediaId = mediaIds.includes(requestedPrimary)
    ? requestedPrimary
    : mediaIds[0] || "";

  return {
    message: typeof content?.text === "string" ? content.text : "",
    destinationUrl:
      typeof content?.primaryUrl === "string" ? content.primaryUrl : "",
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
