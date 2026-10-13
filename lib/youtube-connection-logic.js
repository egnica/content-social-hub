export const YOUTUBE_REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
];
const SOON_MS = 10 * 60 * 1000;
export function normalizeYouTubeScopes(value) {
  return [...new Set((Array.isArray(value) ? value : String(value || "").split(/\s+/)).map(String).filter(Boolean))];
}
export function getYouTubeHealth({ grantedScopes, tokenExpiresAt, hasRefreshToken, channelId, now = new Date() }) {
  const missingPermissions = YOUTUBE_REQUIRED_SCOPES.filter(s => !normalizeYouTubeScopes(grantedScopes).includes(s));
  if (!channelId || missingPermissions.length) return {
    healthStatus: "permission_problem", healthMessage: !channelId ? "YouTube channel identity is missing. Reconnect." : "Missing YouTube permissions. Reconnect.",
    missingPermissions, canPublish: false,
  };
  if (!hasRefreshToken) return {
    healthStatus: "permission_problem", healthMessage: "Google did not grant offline access. Reconnect this channel.",
    missingPermissions: [], canPublish: false,
  };
  const expires = new Date(tokenExpiresAt || 0);
  if (!Number.isFinite(expires.getTime()) || !expires.getTime()) return {
    healthStatus: "expired", healthMessage: "YouTube authorization needs renewal.", missingPermissions: [], canPublish: false,
  };
  if (expires <= now) return {
    healthStatus: "expired", healthMessage: "YouTube access token expired. Run Account Health to renew.", missingPermissions: [], canPublish: false,
  };
  if (expires.getTime() - now.getTime() <= SOON_MS) return {
    healthStatus: "expiring_soon", healthMessage: "YouTube access token expires soon; refresh is available.", missingPermissions: [], canPublish: true,
  };
  return { healthStatus: "healthy", healthMessage: "", missingPermissions: [], canPublish: true };
}
export function selectYouTubeChannel(items) {
  if (!Array.isArray(items) || items.length !== 1) throw new TypeError(
    items?.length ? "Google returned multiple channels. Select the intended channel in Google and reconnect." : "No YouTube channel was returned for this Google authorization.",
  );
  const channel = items[0];
  if (!channel?.id || !channel?.snippet?.title) throw new TypeError("YouTube did not return a verified channel ID and name.");
  return { providerAccountId: String(channel.id), accountName: String(channel.snippet.title),
    pictureUrl: channel.snippet.thumbnails?.default?.url || "" };
}
export function assertSameYouTubeChannel(expectedId, actualId) {
  if (expectedId && expectedId !== actualId) throw new TypeError(
    "This Google authorization belongs to a different YouTube channel. The existing connection was not replaced.",
  );
}
