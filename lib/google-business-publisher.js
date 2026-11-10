import "server-only";
import { googleBusinessPostPayload, googleBusinessPostResult } from "@/lib/google-business-publish-logic";

const BASE = "https://mybusiness.googleapis.com/v4";
export class GoogleBusinessPublishApiError extends Error {
  constructor(status = null, reason = "unavailable") {
    const messages = {
      disabled: "Enable the Google My Business API (mybusiness.googleapis.com) in the approved Google Cloud project before posting.",
      permissions: "Google denied Local Posts access. Check API approval, activation and location permissions.",
      authorization: "Google authorization is unavailable. Reconnect this location.",
      quota: "Google Local Posts quota is exhausted. Check the project quota before retrying.",
      invalid: "Google rejected this update. Review its content and location eligibility before retrying.",
      unavailable: "Google Local Posts could not be reached. Review the recorded submission before retrying.",
    };
    super(messages[reason] || messages.unavailable);
    this.name = "GoogleBusinessPublishApiError";
    this.status = status;
    this.reason = reason;
  }
}
function assertParent(parent) {
  if (!/^accounts\/[A-Za-z0-9_-]+\/locations\/[A-Za-z0-9_-]+$/.test(parent)) {
    throw new TypeError("Invalid Google post location.");
  }
}
async function request(path, token, payload) {
  let response;
  try {
    response = await fetch(`${BASE}/${path}`, {
      method: payload ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    });
  } catch { throw new GoogleBusinessPublishApiError(); }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const disabled = data?.error?.details?.some(item => item?.reason === "SERVICE_DISABLED");
    throw new GoogleBusinessPublishApiError(response.status, disabled ? "disabled" :
      response.status === 401 ? "authorization" : response.status === 403 ? "permissions" :
      response.status === 429 ? "quota" : response.status === 400 ? "invalid" : "unavailable");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new GoogleBusinessPublishApiError();
  return data;
}
export async function checkGoogleBusinessPostsAccess({ accessToken, parent }) {
  assertParent(parent);
  // canOperateLocalPost metadata is deprecated and no longer populated. A
  // read-only Local Posts request checks v4 access; create can still reject eligibility.
  const data = await request(`${parent}/localPosts?pageSize=1`, accessToken);
  if (data.localPosts != null && !Array.isArray(data.localPosts)) throw new GoogleBusinessPublishApiError();
}
export async function createGoogleBusinessPost({ accessToken, parent, version, imageSourceUrl = "" }) {
  assertParent(parent);
  return googleBusinessPostResult(
    await request(`${parent}/localPosts`, accessToken, googleBusinessPostPayload(version, imageSourceUrl)), parent);
}
export async function getGoogleBusinessPost({ accessToken, parent, name }) {
  assertParent(parent);
  if (!name.startsWith(`${parent}/localPosts/`) ||
      !/^[A-Za-z0-9_-]+$/.test(name.slice(`${parent}/localPosts/`.length))) throw new TypeError("Invalid recorded Google post.");
  return googleBusinessPostResult(await request(name, accessToken), parent, name);
}
