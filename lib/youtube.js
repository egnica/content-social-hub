import "server-only";
import { getAppBaseUrl, requireEnv } from "@/lib/env";
import { YOUTUBE_AUTHORIZATION_SCOPES, selectYouTubeChannel, normalizeYouTubeScopes } from "@/lib/youtube-connection-logic";
const TIMEOUT_MS = 10000;
export class YouTubeApiError extends Error {
  constructor(message, status = null) { super(message); this.name = "YouTubeApiError"; this.status = status; }
}
export function getYouTubeRedirectUri() {
  return `${getAppBaseUrl()}/api/connections/youtube/callback`;
}
export function createYouTubeAuthorizationUrl(state) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", requireEnv("YOUTUBE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", getYouTubeRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_AUTHORIZATION_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}
async function tokenRequest(body) {
  let response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...body, client_id: requireEnv("YOUTUBE_CLIENT_ID"),
        client_secret: requireEnv("YOUTUBE_CLIENT_SECRET"),
      }), cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch { throw new YouTubeApiError("Google token service is unavailable."); }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.access_token || !(Number(payload.expires_in) > 0)) {
    throw new YouTubeApiError("Google could not authorize or refresh YouTube access.", response.status);
  }
  return { accessToken: payload.access_token, refreshToken: payload.refresh_token || "",
    grantedScopes: normalizeYouTubeScopes(payload.scope),
    expiresAt: new Date(Date.now() + Number(payload.expires_in) * 1000) };
}
export async function exchangeYouTubeCode(code) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: getYouTubeRedirectUri() });
}
export async function refreshYouTubeToken(refreshToken) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}
export async function getAuthorizedYouTubeChannel(accessToken) {
  let response;
  try {
    response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch { throw new YouTubeApiError("YouTube channel lookup is unavailable."); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new YouTubeApiError("YouTube could not verify channel identity.", response.status);
  return selectYouTubeChannel(data?.items);
}
