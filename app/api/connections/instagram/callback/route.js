import { NextResponse } from "next/server";
import {
  consumeInstagramOauthState,
  createInstagramSelectionFlow,
} from "@/lib/connections";
import { getAppBaseUrl } from "@/lib/env";
import {
  exchangeInstagramCode,
  getInstagramProfile,
} from "@/lib/instagram";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function appUrl(pathname) {
  return new URL(pathname, getAppBaseUrl());
}

function errorRedirect(reason) {
  const url = appUrl("/connect/instagram/error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url, 303);
}

export async function GET(request) {
  const url = new URL(request.url);
  const stateValue = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (url.searchParams.get("error")) {
    return errorRedirect("cancelled");
  }

  if (!stateValue || !code) {
    return errorRedirect("invalid");
  }

  try {
    const state = await consumeInstagramOauthState(stateValue);

    if (!state) {
      return errorRedirect("expired");
    }

    if (state.mode !== "owner" || !(await getSession())) {
      return NextResponse.redirect(appUrl("/login"), 303);
    }

    const token = await exchangeInstagramCode(code);
    const profile = await getInstagramProfile(token.accessToken);

    // The one-time OAuth state binds this authorization to the selected client.
    // Persist Instagram's authenticated Professional-account identity from /me;
    // do not require Meta's OAuth subject ID to equal that Professional account ID.
    const confirmationToken = await createInstagramSelectionFlow({
      clientId: state.clientId,
      mode: state.mode,
      profile,
      accessToken: token.accessToken,
      permissions: token.permissions,
      tokenExpiresAt: token.expiresAt,
    });
    const confirmationUrl = appUrl("/connect/instagram/confirm");
    confirmationUrl.searchParams.set("token", confirmationToken);
    const response = NextResponse.redirect(confirmationUrl, 303);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    console.error("Instagram OAuth callback failed", {
      name: error?.name || "Error",
      message: error?.message || "Unknown Instagram OAuth error",
      code: error?.details?.code ?? null,
    });
    return errorRedirect("provider");
  }
}
