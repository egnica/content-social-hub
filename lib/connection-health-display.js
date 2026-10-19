const LABELS = {
  healthy: "Healthy",
  expiring_soon: "Needs attention",
  expired: "Expired",
  disconnected: "Needs attention",
  permission_problem: "Needs attention",
  api_error: "Error",
};

const RENEWABLE_GOOGLE_PLATFORMS = new Set(["google_business_profile", "youtube"]);
const RECONNECT_PATH = {
  linkedin: "linkedin",
  youtube: "youtube",
  google_business_profile: "google-business",
};

// A past successful check is not evidence that the connection is still healthy today.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function getConnectionHealthDisplay(connection, { now } = {}) {
  const status = connection?.healthStatus;
  const healthy = status === "healthy" ||
    (RENEWABLE_GOOGLE_PLATFORMS.has(connection?.platform) && status === "expiring_soon");
  const label = healthy ? "Healthy" : LABELS[status] || "Not checked";
  const needsAttention = ["expired", "disconnected", "permission_problem", "api_error"].includes(status) ||
    (status === "expiring_soon" && !healthy);
  const timestamp = new Date(connection?.lastHealthCheckAt || 0).getTime();
  const today = new Date(now ?? Date.now()).getTime();
  const stale = !Number.isFinite(timestamp) || timestamp <= 0 ||
    (Number.isFinite(today) && today - timestamp > STALE_AFTER_MS);
  return { label, healthy, needsAttention, stale };
}

// Facebook and Instagram use generic Connect flows that do not target an existing
// connection identity. Do not present these as safe per-account Reconnect actions.
export function getConnectionReconnectUrl(connection) {
  const path = RECONNECT_PATH[connection?.platform];
  if (!path || !connection?.clientId || !connection?._id) return null;
  return `/api/connections/${path}/start?clientId=${encodeURIComponent(connection.clientId)}&connectionId=${encodeURIComponent(connection._id)}`;
}
