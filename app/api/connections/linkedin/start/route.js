import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createLinkedInOauthState, getConnectionRequestByToken } from "@/lib/connections";
import { isConnectionRequestUsableForPlatform } from "@/lib/connection-request-logic";
import { getAppBaseUrl } from "@/lib/env";
import { createLinkedInAuthorizationUrl } from "@/lib/linkedin";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function appUrl(path) { return new URL(path, getAppBaseUrl()); }

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const requestToken = url.searchParams.get("requestToken");
    if (requestToken) {
      const connectionRequest = await getConnectionRequestByToken(requestToken);
      if (!isConnectionRequestUsableForPlatform(connectionRequest, "linkedin")) {
        return NextResponse.redirect(appUrl("/connect/linkedin/error?reason=request"), 303);
      }
      const state = await createLinkedInOauthState({
        clientId: connectionRequest.clientId,
        requestId: connectionRequest._id,
        mode: "request",
      });
      const response = NextResponse.redirect(createLinkedInAuthorizationUrl(state), 303);
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }
    if (!(await getSession())) return NextResponse.redirect(appUrl("/login"), 303);
    const state = await createLinkedInOauthState({
      clientId: url.searchParams.get("clientId"), mode: "owner",
    });
    const response = NextResponse.redirect(createLinkedInAuthorizationUrl(state), 303);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return apiError(error, "Unable to begin LinkedIn authorization.");
  }
}
