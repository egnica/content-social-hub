const HEALTH_LABELS = {
  healthy: "Healthy",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  disconnected: "Disconnected",
  permission_problem: "Permission Problem",
  api_error: "API Error",
};

export function getConnectionHealthDisplay(connection) {
  const status = connection?.healthStatus;
  // A renewable Google access token nearing its routine expiration is not a reconnect problem.
  const healthy = status === "healthy" ||
    (connection?.platform === "google_business_profile" && status === "expiring_soon");
  return { label: healthy ? "Healthy" : (HEALTH_LABELS[status] || "Not checked"), healthy };
}
