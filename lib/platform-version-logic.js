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
