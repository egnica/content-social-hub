import "server-only";

import { createHmac } from "node:crypto";
import { getAppBaseUrl, requireEnv } from "@/lib/env";

const DEFAULT_GRAPH_VERSION = "v26.0";
const REQUIRED_PERMISSIONS = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
];

export class FacebookApiError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "FacebookApiError";
    this.details = details;
  }
}

function getGraphVersion() {
  return process.env.META_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION;
}

function getMetaConfig() {
  return {
    appId: requireEnv("META_APP_ID"),
    appSecret: requireEnv("META_APP_SECRET"),
    loginConfigId: process.env.META_LOGIN_CONFIG_ID?.trim() || "",
  };
}

export function getFacebookRedirectUri() {
  return `${getAppBaseUrl()}/api/connections/facebook/callback`;
}

export function getFacebookRequiredPermissions() {
  return [...REQUIRED_PERMISSIONS];
}

export function createFacebookAuthorizationUrl(state) {
  const { appId, loginConfigId } = getMetaConfig();
  const url = new URL(
    `https://www.facebook.com/${getGraphVersion()}/dialog/oauth`,
  );

  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", getFacebookRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");

  if (loginConfigId) {
    url.searchParams.set("config_id", loginConfigId);
    url.searchParams.set("override_default_response_type", "true");
  } else {
    url.searchParams.set("scope", REQUIRED_PERMISSIONS.join(","));
  }

  return url.toString();
}

function createAppSecretProof(accessToken) {
  const { appSecret } = getMetaConfig();
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

async function readGraphResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    throw new FacebookApiError(
      payload?.error?.message || "Facebook returned an unexpected response.",
      payload?.error || payload,
    );
  }

  return payload;
}

async function graphRequest(path, accessToken, params = {}) {
  const url = new URL(
    `https://graph.facebook.com/${getGraphVersion()}/${path.replace(/^\//, "")}`,
  );

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("appsecret_proof", createAppSecretProof(accessToken));

  return readGraphResponse(
    await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
  );
}

export async function exchangeFacebookCode(code) {
  const { appId, appSecret } = getMetaConfig();
  const url = new URL(
    `https://graph.facebook.com/${getGraphVersion()}/oauth/access_token`,
  );

  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", getFacebookRedirectUri());
  url.searchParams.set("code", code);

  const shortLived = await readGraphResponse(
    await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
  );

  const exchangeUrl = new URL(
    `https://graph.facebook.com/${getGraphVersion()}/oauth/access_token`,
  );
  exchangeUrl.searchParams.set("grant_type", "fb_exchange_token");
  exchangeUrl.searchParams.set("client_id", appId);
  exchangeUrl.searchParams.set("client_secret", appSecret);
  exchangeUrl.searchParams.set("fb_exchange_token", shortLived.access_token);

  return readGraphResponse(
    await fetch(exchangeUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
  );
}

export async function getFacebookPermissions(userAccessToken) {
  const payload = await graphRequest("me/permissions", userAccessToken);
  return (payload.data || [])
    .filter((permission) => permission.status === "granted")
    .map((permission) => permission.permission);
}

export async function listFacebookPages(userAccessToken) {
  let nextUrl = new URL(
    `https://graph.facebook.com/${getGraphVersion()}/me/accounts`,
  );
  nextUrl.searchParams.set(
    "fields",
    "id,name,picture.type(square){url},access_token,tasks",
  );
  nextUrl.searchParams.set("limit", "100");
  nextUrl.searchParams.set("access_token", userAccessToken);
  nextUrl.searchParams.set(
    "appsecret_proof",
    createAppSecretProof(userAccessToken),
  );

  const pages = [];

  while (nextUrl && pages.length < 250) {
    const payload = await readGraphResponse(
      await fetch(nextUrl, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      }),
    );
    pages.push(...(payload.data || []));
    nextUrl = payload.paging?.next ? new URL(payload.paging.next) : null;
  }

  return pages.map((page) => ({
    providerAccountId: page.id,
    accountName: page.name,
    pictureUrl: page.picture?.data?.url || "",
    tasks: Array.isArray(page.tasks) ? page.tasks : [],
    accessToken: page.access_token,
  }));
}

export async function inspectFacebookToken(accessToken) {
  const { appId, appSecret } = getMetaConfig();
  const url = new URL(
    `https://graph.facebook.com/${getGraphVersion()}/debug_token`,
  );
  url.searchParams.set("input_token", accessToken);
  url.searchParams.set("access_token", `${appId}|${appSecret}`);

  const payload = await readGraphResponse(
    await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
  );
  const data = payload.data || {};

  return {
    isValid: Boolean(data.is_valid),
    expiresAt: data.expires_at ? new Date(data.expires_at * 1000) : null,
    dataAccessExpiresAt: data.data_access_expires_at
      ? new Date(data.data_access_expires_at * 1000)
      : null,
    scopes: Array.isArray(data.scopes) ? data.scopes : [],
  };
}

export async function checkFacebookPage(pageId, pageAccessToken) {
  const page = await graphRequest(pageId, pageAccessToken, {
    fields: "id,name,picture.type(square){url}",
  });

  return {
    providerAccountId: page.id,
    accountName: page.name,
    pictureUrl: page.picture?.data?.url || "",
  };
}
