import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createGoogleBusinessOauthState } from "@/lib/connections";
import { getAppBaseUrl, requireEnv } from "@/lib/env";
import { createGoogleBusinessAuthorizationUrl } from "@/lib/google-business";
import { GOOGLE_BUSINESS_STATE_COOKIE, googleBusinessCookieOptions } from "@/lib/google-business-oauth-browser";
import { hashSecureToken } from "@/lib/secure-values";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    if (!await getSession()) return NextResponse.redirect(new URL("/login", getAppBaseUrl()), 303);
    // Validate configuration before creating a pending database state.
    createGoogleBusinessAuthorizationUrl("configuration-check");
    requireEnv("GOOGLE_BUSINESS_CLIENT_SECRET");
    requireEnv("OAUTH_TOKEN_ENCRYPTION_KEY");
    const url = new URL(request.url);
    const state = await createGoogleBusinessOauthState({ clientId: url.searchParams.get("clientId"),
      connectionId: url.searchParams.get("connectionId") || "" });
    const response = NextResponse.redirect(createGoogleBusinessAuthorizationUrl(state), 303);
    response.cookies.set(GOOGLE_BUSINESS_STATE_COOKIE, hashSecureToken(state), googleBusinessCookieOptions(600));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    if (error instanceof TypeError) return Response.json({ error: error.message }, { status: 400 });
    return apiError(error, "Unable to begin Google Business authorization.");
  }
}
