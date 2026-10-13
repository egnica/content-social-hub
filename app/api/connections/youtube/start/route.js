import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createYouTubeOauthState, createYouTubeReconnectState, getConnectionRequestByToken } from "@/lib/connections";
import { isConnectionRequestUsableForPlatform } from "@/lib/connection-request-logic";
import { getAppBaseUrl } from "@/lib/env";
import { createYouTubeAuthorizationUrl } from "@/lib/youtube";
import { getSession } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const requestToken = url.searchParams.get("requestToken");
    if (requestToken) {
      const connectionRequest = await getConnectionRequestByToken(requestToken);
      if (!isConnectionRequestUsableForPlatform(connectionRequest, "youtube")) {
        return NextResponse.redirect(new URL("/connect/youtube/error?reason=request", getAppBaseUrl()), 303);
      }
      const state = await createYouTubeOauthState({
        clientId: connectionRequest.clientId,
        requestId: connectionRequest._id,
        mode: "request",
      });
      const response = NextResponse.redirect(createYouTubeAuthorizationUrl(state), 303);
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    if (!(await getSession())) return NextResponse.redirect(new URL("/login", getAppBaseUrl()), 303);
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
