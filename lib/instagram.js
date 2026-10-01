import "server-only";

import { getAppBaseUrl, requireEnv } from "@/lib/env";
import {
  getInstagramProviderAccountId,
  INSTAGRAM_REQUIRED_PERMISSIONS,
  normalizeInstagramPermissions,
} from "@/lib/instagram-connection-logic";

const DEFAULT_GRAPH_VERSION = "v26.0";

export class InstagramApiError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "InstagramApiError";
    this.details = details;
  }
}

function getGraphVersion() {
  return process.env.INSTAGRAM_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION;
}

function getInstagramConfig() {
  return {
    appId: requireEnv("INSTAGRAM_APP_ID"),
    appSecret: requireEnv("INSTAGRAM_APP_SECRET"),
  };
}

export function getInstagramRedirectUri() {
  return `${getAppBaseUrl()}/api/connections/instagram/callback`;
}

export function getInstagramRequiredPermissions() {
  return [...INSTAGRAM_REQUIRED_PERMISSIONS];
}

export function createInstagramAuthorizationUrl(state) {
  const { appId } = getInstagramConfig();
  const url = new URL("https://www.instagram.com/oauth/authorize");

  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", getInstagramRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_REQUIRED_PERMISSIONS.join(","));
  url.searchParams.set("state", state);
  url.searchParams.set("enable_fb_login", "0");

  return url.toString();
}

async function readJsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error || payload?.error_type) {
    const details = payload?.error || payload || null;
    throw new InstagramApiError(
      payload?.error?.message || payload?.error_message || fallbackMessage,
      details,
    );
  }

  return payload;
}

function normalizeShortLivedToken(payload) {
  let tokenPayload = payload;

  if (Array.isArray(payload?.data)) {
    if (payload.data.length !== 1 || payload.access_token) {
      throw new InstagramApiError(
        "Instagram returned an ambiguous token response.",
        payload,
      );
    }
    [tokenPayload] = payload.data;
  }

  if (!tokenPayload?.access_token || !tokenPayload?.user_id) {
    throw new InstagramApiError(
      "Instagram did not return an access token and account ID.",
      payload,
    );
  }

  return {
    accessToken: tokenPayload.access_token,
    providerAccountId: String(tokenPayload.user_id),
    permissions: normalizeInstagramPermissions(tokenPayload.permissions),
  };
}

export async function exchangeInstagramCode(code) {
  const { appId, appSecret } = getInstagramConfig();
  const body = new FormData();
  body.set("client_id", appId);
  body.set("client_secret", appSecret);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", getInstagramRedirectUri());
  body.set("code", code);

  const shortPayload = await readJsonResponse(
    await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body,
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
    "Instagram could not exchange the authorization code.",
  );
  const shortLived = normalizeShortLivedToken(shortPayload);
  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("access_token", shortLived.accessToken);

  const longPayload = await readJsonResponse(
    await fetch(longUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
    "Instagram could not create a long-lived access token.",
  );

  if (!longPayload?.access_token) {
    throw new InstagramApiError(
      "Instagram did not return a long-lived access token.",
      longPayload,
    );
  }

  const expiresIn = Number(longPayload.expires_in || 0);

  return {
    accessToken: longPayload.access_token,
    providerAccountId: shortLived.providerAccountId,
    permissions: shortLived.permissions,
    expiresAt:
      expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null,
  };
}

export async function getInstagramProfile(accessToken) {
  const url = new URL(
    `https://graph.instagram.com/${getGraphVersion()}/me`,
  );
  url.searchParams.set(
    "fields",
    "id,user_id,username,account_type,profile_picture_url",
  );
  url.searchParams.set("access_token", accessToken);

  const profile = await readJsonResponse(
    await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
    "Instagram could not verify this Professional account.",
  );
  const providerAccountId = getInstagramProviderAccountId(profile);

  if (!providerAccountId || !profile?.username) {
    throw new InstagramApiError(
      "Instagram did not return an account ID and username.",
      profile,
    );
  }

  return {
    providerAccountId,
    username: String(profile.username),
    accountName: `@${profile.username}`,
    accountType: profile.account_type || "",
    pictureUrl: profile.profile_picture_url || "",
  };
}
