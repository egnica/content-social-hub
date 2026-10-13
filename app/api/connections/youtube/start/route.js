import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createYouTubeOauthState, createYouTubeReconnectState } from "@/lib/connections";
import { getAppBaseUrl } from "@/lib/env";
import { createYouTubeAuthorizationUrl } from "@/lib/youtube";
import { getSession } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    if (!(await getSession())) return NextResponse.redirect(new URL("/login", getAppBaseUrl()), 303);
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId");
    const connectionId = url.searchParams.get("connectionId");
    const state = connectionId
      ? await createYouTubeReconnectState({ clientId, connectionId })
      : await createYouTubeOauthState({ clientId });
    const response = NextResponse.redirect(createYouTubeAuthorizationUrl(state), 303);
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) { return apiError(error, "Unable to begin YouTube authorization."); }
}
