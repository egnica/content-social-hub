import "server-only";

import { getAppBaseUrl, requireEnv } from "@/lib/env";
import {
  LINKEDIN_REQUIRED_SCOPES,
  linkedinProfileIdentity,
  normalizeLinkedInScopes,
} from "@/lib/linkedin-connection-logic";

const API_TIMEOUT_MS = 10000;

export class LinkedInApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "LinkedInApiError";
    this.details = details;
  }
}

export function getLinkedInRedirectUri() {
  return `${getAppBaseUrl()}/api/connections/linkedin/callback`;
}

export function createLinkedInAuthorizationUrl(state) {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", requireEnv("LINKEDIN_CLIENT_ID"));
  url.searchParams.set("redirect_uri", getLinkedInRedirectUri());
  url.searchParams.set("scope", LINKEDIN_REQUIRED_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export async function inspectLinkedInToken(accessToken) {
  const response = await fetch("https://www.linkedin.com/oauth/v2/introspectToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: requireEnv("LINKEDIN_CLIENT_ID"),
      client_secret: requireEnv("LINKEDIN_CLIENT_SECRET"),
      token: accessToken,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new LinkedInApiError("LinkedIn token introspection failed.", { operation: "introspect_token", status: response.status });
  }
  if (!payload?.active) {
    throw new LinkedInApiError("LinkedIn access token is invalid or expired.", { operation: "introspect_token", status: 401 });
  }
  const expiresAt = Number.isFinite(Number(payload.expires_at)) &&
    Number(payload.expires_at) > 0
    ? new Date(Number(payload.expires_at) * 1000)
    : null;
  return {
    grantedScopes: normalizeLinkedInScopes(payload.scope),
    expiresAt,
  };
}

export async function exchangeLinkedInCode(code) {
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getLinkedInRedirectUri(),
      client_id: requireEnv("LINKEDIN_CLIENT_ID"),
      client_secret: requireEnv("LINKEDIN_CLIENT_SECRET"),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => null);
  const expiresIn = Number(payload?.expires_in);
  if (!response.ok || !payload?.access_token || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new LinkedInApiError("LinkedIn could not complete authorization.", {
      operation: "exchange_code",
      status: response.status,
      code: typeof payload?.error === "string" ? payload.error.slice(0, 64) : null,
    });
  }
  const tokenDetails = await inspectLinkedInToken(payload.access_token);
  return {
    accessToken: payload.access_token,
    expiresAt: tokenDetails.expiresAt || new Date(Date.now() + expiresIn * 1000),
    grantedScopes: tokenDetails.grantedScopes,
  };
}

export async function getLinkedInProfile(accessToken) {
  const response = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  const profile = await response.json().catch(() => null);
  if (!response.ok) {
    throw new LinkedInApiError("LinkedIn could not verify this member profile.", {
      operation: "fetch_profile",
      status: response.status,
      code: typeof profile?.serviceErrorCode === "number" ? profile.serviceErrorCode : null,
    });
  }
  return linkedinProfileIdentity(profile);
}
