import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createGoogleBusinessOauthState, getConnectionRequestByToken } from "@/lib/connections";
import { isConnectionRequestUsableForPlatform } from "@/lib/connection-request-logic";
import { getAppBaseUrl, requireEnv } from "@/lib/env";
import { createGoogleBusinessAuthorizationUrl } from "@/lib/google-business";
import { GOOGLE_BUSINESS_STATE_COOKIE, googleBusinessCookieOptions } from "@/lib/google-business-oauth-browser";
import { hashSecureToken } from "@/lib/secure-values";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const requestToken = url.searchParams.get("requestToken");
    if (!requestToken && !await getSession()) {
      return NextResponse.redirect(new URL("/login", getAppBaseUrl()), 303);
    }
    createGoogleBusinessAuthorizationUrl("configuration-check");
    requireEnv("GOOGLE_BUSINESS_CLIENT_SECRET");
    requireEnv("OAUTH_TOKEN_ENCRYPTION_KEY");
    let state;
    if (requestToken) {
      const connectionRequest = await getConnectionRequestByToken(requestToken);
      if (!isConnectionRequestUsableForPlatform(connectionRequest, "google_business_profile")) {
        return NextResponse.redirect(new URL("/connect/google-business/error?reason=request", getAppBaseUrl()), 303);
      }
      state = await createGoogleBusinessOauthState({
        clientId: connectionRequest.clientId, mode: "request", requestId: connectionRequest._id,
      });
    } else {
      state = await createGoogleBusinessOauthState({
        clientId: url.searchParams.get("clientId"), connectionId: url.searchParams.get("connectionId") || "",
        mode: "owner",
      });
    }
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
