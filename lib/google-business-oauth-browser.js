import "server-only";
import { cookies } from "next/headers";
import { hashSecureToken } from "@/lib/secure-values";

export const GOOGLE_BUSINESS_STATE_COOKIE = "google_business_oauth_state";
export const GOOGLE_BUSINESS_SELECTION_COOKIE = "google_business_selection";
export function googleBusinessCookieOptions(maxAge) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge };
}
export async function matchesGoogleBusinessBrowser(name, value) {
  if (typeof value !== "string" || !value) return false;
  return (await cookies()).get(name)?.value === hashSecureToken(value);
}
