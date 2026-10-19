import { NextResponse } from "next/server";
import { consumeGoogleBusinessOauthState, createGoogleBusinessSelectionFlow } from "@/lib/connections";
import { getAppBaseUrl } from "@/lib/env";
import { exchangeGoogleBusinessCode, listGoogleBusinessLocations, GoogleBusinessApiError } from "@/lib/google-business";
import { GOOGLE_BUSINESS_STATE_COOKIE, GOOGLE_BUSINESS_SELECTION_COOKIE,
  googleBusinessCookieOptions, matchesGoogleBusinessBrowser } from "@/lib/google-business-oauth-browser";
import { hashSecureToken } from "@/lib/secure-values";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
function redirect(path, params = {}) {
  const url = new URL(path, getAppBaseUrl());
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  const response = NextResponse.redirect(url, 303);
  response.cookies.set(GOOGLE_BUSINESS_STATE_COOKIE, "", googleBusinessCookieOptions(0));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export async function GET(request) {
  let clientId = "";
  try {
    const url = new URL(request.url), value = url.searchParams.get("state");
    if (!await matchesGoogleBusinessBrowser(GOOGLE_BUSINESS_STATE_COOKIE, value)) {
      return redirect("/connect/google-business/error", { reason: "invalid" });
    }
    const state = await consumeGoogleBusinessOauthState(value);
    if (!state) return redirect("/connect/google-business/error", { reason: "expired" });
    if (state.mode === "owner") {
      if (!await getSession()) return redirect("/login");
      clientId = state.clientId;
    } else if (state.mode !== "request" || !state.requestId) {
      return redirect("/connect/google-business/error", { reason: "request" });
    }
    if (url.searchParams.get("error")) return redirect("/connect/google-business/error", { reason: "cancelled", clientId });
    const code = url.searchParams.get("code");
    if (!code) return redirect("/connect/google-business/error", { reason: "invalid", clientId });
    const tokens = await exchangeGoogleBusinessCode(code);
    const locations = await listGoogleBusinessLocations(tokens.accessToken);
    const token = await createGoogleBusinessSelectionFlow({ state, locations, tokens });
    const response = redirect("/connect/google-business/select", { token });
    response.cookies.set(GOOGLE_BUSINESS_SELECTION_COOKIE, hashSecureToken(token), googleBusinessCookieOptions(1200));
    return response;
  } catch (error) {
    // Never log provider responses, URLs, codes or credentials.
    console.error("Google Business OAuth callback failed", {
      name: error?.name, reason: error?.reason || "identity", status: error?.status || null,
    });
    return redirect("/connect/google-business/error", {
      reason: error instanceof GoogleBusinessApiError ? error.reason
        : error?.reason === "request" ? "request"
        : error instanceof TypeError ? "identity" : "provider", clientId,
    });
  }
}
