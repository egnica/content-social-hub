export const CONNECTION_REQUEST_PLATFORMS = ["facebook", "instagram"];

export function normalizeConnectionRequestPlatforms(input) {
  const values = Array.isArray(input)
    ? input
    : input == null || input === ""
      ? ["facebook"]
      : [input];
  const platforms = [
    ...new Set(
      values
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  if (!platforms.length) {
    return ["facebook"];
  }

  const unsupported = platforms.filter(
    (platform) => !CONNECTION_REQUEST_PLATFORMS.includes(platform),
  );

  if (unsupported.length) {
    throw new TypeError(
      `Unsupported connection request platform: ${unsupported.join(", ")}`,
    );
  }

  return platforms;
}

export function createRequestedPlatformStatus(platforms) {
  return Object.fromEntries(
    normalizeConnectionRequestPlatforms(platforms).map((platform) => [
      platform,
      "requested",
    ]),
  );
}

export function requestIncludesPlatform(request, platform) {
  return Boolean(request?.requestedPlatforms?.includes(platform));
}

export function requestsSharePlatform(left, right) {
  const rightSet = new Set(normalizeConnectionRequestPlatforms(right));
  return normalizeConnectionRequestPlatforms(left).some((platform) =>
    rightSet.has(platform),
  );
}

export function isConnectionRequestUsableForPlatform(
  request,
  platform,
  now = new Date(),
) {
  if (!request || request.status !== "pending") return false;
  if (!requestIncludesPlatform(request, platform)) return false;

  const expiresAt = new Date(request.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) return false;

  return request.platformStatus?.[platform] !== "connected";
}

export function markConnectionRequestPlatformConnected(request, platform) {
  if (!requestIncludesPlatform(request, platform)) {
    throw new TypeError(`This request does not include ${platform}.`);
  }

  const platformStatus = {
    ...(request.platformStatus || {}),
    [platform]: "connected",
  };
  const completed = request.requestedPlatforms.every(
    (requestedPlatform) =>
      platformStatus[requestedPlatform] === "connected",
  );

  return {
    platformStatus,
    status: completed ? "completed" : "pending",
    completed,
  };
}
