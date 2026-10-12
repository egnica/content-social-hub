import { NextResponse } from "next/server";
import { consumeLinkedInOauthState, createLinkedInSelectionFlow } from "@/lib/connections";
import { getAppBaseUrl } from "@/lib/env";
import { exchangeLinkedInCode, getLinkedInProfile } from "@/lib/linkedin";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
function appUrl(path) { return new URL(path, getAppBaseUrl()); }
function errorRedirect(reason) {
  const url = appUrl("/connect/linkedin/error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url, 303);
}
export async function GET(request) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return errorRedirect("cancelled");
  const stateValue = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!stateValue || !code) return errorRedirect("invalid");
  try {
    const state = await consumeLinkedInOauthState(stateValue);
    if (!state) return errorRedirect("expired");
    if (state.mode === "owner") {
      if (!(await getSession())) return NextResponse.redirect(appUrl("/login"), 303);
    } else if (state.mode !== "request" || !state.requestId) {
      return errorRedirect("request");
    }
    const token = await exchangeLinkedInCode(code);
    const profile = await getLinkedInProfile(token.accessToken);
    if (state.expectedProviderAccountId &&
        state.expectedProviderAccountId !== profile.providerAccountId) {
      return errorRedirect("identity");
    }
    const selectionToken = await createLinkedInSelectionFlow({
      clientId: state.clientId,
      requestId: state.requestId,
      mode: state.mode,
      profile,
      accessToken: token.accessToken,
      grantedScopes: token.grantedScopes,
      tokenExpiresAt: token.expiresAt,
    });
    const confirmationUrl = appUrl("/connect/linkedin/confirm");
    confirmationUrl.searchParams.set("token", selectionToken);
    const response = NextResponse.redirect(confirmationUrl, 303);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    console.error("LinkedIn OAuth callback failed", {
      name: error?.name || "Error", code: error?.details?.code || null,
    });
    return errorRedirect("provider");
  }
}
