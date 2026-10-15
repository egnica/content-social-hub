import "server-only";
import { getAppBaseUrl, requireEnv } from "@/lib/env";
import { GOOGLE_BUSINESS_SCOPE, normalizeGoogleBusinessScopes, assertGoogleBusinessResource,
  normalizeGoogleBusinessLocation } from "@/lib/google-business-connection-logic";

const ACCOUNT_API = "https://mybusinessaccountmanagement.googleapis.com/v1";
const LOCATION_API = "https://mybusinessbusinessinformation.googleapis.com/v1";
const READ_MASK = "name,title,storefrontAddress";
export class GoogleBusinessApiError extends Error {
  constructor(reason, status = null) {
    const messages = {
      authorization: "Google authorization expired or was revoked. Reconnect the business location.",
      permissions: "Google denied Business Profile access. Check project approval and your owner or manager permissions.",
      disabled: "Enable the Business Profile Account Management and Business Information APIs in this Google Cloud project.",
      quota: "Google Business API access is unavailable because of a quota limit. A zero project quota means API approval is still required.",
      unavailable: "Google Business Profile is temporarily unavailable. Try connecting again.",
      incomplete: "Google could not return the complete business location list. Try connecting again.",
    };
    super(messages[reason] || messages.unavailable);
    this.name = "GoogleBusinessApiError"; this.reason = reason; this.status = status;
  }
}
export function getGoogleBusinessRedirectUri() {
  return `${getAppBaseUrl()}/api/connections/google-business/callback`;
}
export function createGoogleBusinessAuthorizationUrl(state) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for (const [key, value] of Object.entries({ client_id: requireEnv("GOOGLE_BUSINESS_CLIENT_ID"),
    redirect_uri: getGoogleBusinessRedirectUri(), response_type: "code", scope: GOOGLE_BUSINESS_SCOPE,
    access_type: "offline", prompt: "consent select_account", state })) url.searchParams.set(key, value);
  return url.toString();
}
async function tokenRequest(body) {
  let response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", { method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...body, client_id: requireEnv("GOOGLE_BUSINESS_CLIENT_ID"),
        client_secret: requireEnv("GOOGLE_BUSINESS_CLIENT_SECRET") }),
      cache: "no-store", signal: AbortSignal.timeout(10000), redirect: "error" });
  } catch { throw new GoogleBusinessApiError("unavailable"); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new GoogleBusinessApiError(
    data?.error === "invalid_grant" ? "authorization" : "unavailable", response.status);
  if (typeof data?.access_token !== "string" || !data.access_token || !Number.isFinite(Number(data.expires_in)) || Number(data.expires_in) <= 0) {
    throw new GoogleBusinessApiError("unavailable", response.status);
  }
  return { accessToken: data.access_token, refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : "",
    grantedScopes: normalizeGoogleBusinessScopes(data.scope), expiresAt: new Date(Date.now() + Number(data.expires_in) * 1000) };
}
export async function exchangeGoogleBusinessCode(code) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: getGoogleBusinessRedirectUri() });
}
export async function refreshGoogleBusinessToken(refreshToken) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}
function lookupContext() { return { deadline: Date.now() + 25000, requests: 0 }; }
async function get(url, accessToken, context) {
  if (++context.requests > 30 || Date.now() >= context.deadline) throw new GoogleBusinessApiError("incomplete");
  let response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(Math.min(10000, context.deadline - Date.now())) });
  } catch { throw new GoogleBusinessApiError("unavailable"); }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const disabled = data?.error?.details?.some(detail => detail?.reason === "SERVICE_DISABLED");
    throw new GoogleBusinessApiError(disabled ? "disabled" : response.status === 429 ? "quota"
      : response.status === 401 ? "authorization" : response.status === 403 ? "permissions" : "unavailable", response.status);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new GoogleBusinessApiError("incomplete");
  return data;
}
async function* pages(base, field, accessToken, context) {
  const seen = new Set();
  let pageToken = "";
  do {
    const url = new URL(base);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await get(url, accessToken, context);
    if (data[field] != null && !Array.isArray(data[field])) throw new GoogleBusinessApiError("incomplete");
    yield data[field] || [];
    pageToken = data.nextPageToken || "";
    if (typeof pageToken !== "string" || (pageToken && seen.has(pageToken))) throw new GoogleBusinessApiError("incomplete");
    seen.add(pageToken);
  } while (pageToken);
}
function locationsUrl(accountName) {
  assertGoogleBusinessResource(accountName, "accounts");
  const url = new URL(`${LOCATION_API}/${accountName}/locations`);
  url.searchParams.set("readMask", READ_MASK); url.searchParams.set("pageSize", "100");
  return url;
}
export async function listGoogleBusinessLocations(accessToken) {
  const context = lookupContext(), locations = new Map();
  for await (const accounts of pages(`${ACCOUNT_API}/accounts?pageSize=20`, "accounts", accessToken, context)) {
    for (const account of accounts) {
      for await (const items of pages(locationsUrl(account.name), "locations", accessToken, context)) {
        for (const item of items) {
          const location = normalizeGoogleBusinessLocation(account, item);
          // The same location can be accessible through more than one account.
          const key = `${location.accountResourceName}/${location.locationResourceName}`;
          locations.set(key, location);
          if (locations.size > 1000) throw new GoogleBusinessApiError("incomplete");
        }
      }
    }
  }
  return [...locations.values()];
}
export async function verifyGoogleBusinessLocation(accessToken, accountResourceName, locationResourceName) {
  assertGoogleBusinessResource(locationResourceName, "locations");
  const context = lookupContext();
  for await (const items of pages(locationsUrl(accountResourceName), "locations", accessToken, context)) {
    const item = items.find(location => location?.name === locationResourceName);
    if (item) return normalizeGoogleBusinessLocation({ name: accountResourceName }, item);
  }
  throw new GoogleBusinessApiError("permissions", 403);
}
