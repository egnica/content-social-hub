import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import {
  createInstagramOauthState,
  getConnectionRequestByToken,
} from "@/lib/connections";
import { isConnectionRequestUsableForPlatform } from "@/lib/connection-request-logic";
import { getAppBaseUrl } from "@/lib/env";
import { createInstagramAuthorizationUrl } from "@/lib/instagram";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function appUrl(pathname) {
  return new URL(pathname, getAppBaseUrl());
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const requestToken = url.searchParams.get("requestToken");

    if (requestToken) {
      const connectionRequest = await getConnectionRequestByToken(requestToken);

      if (
        !isConnectionRequestUsableForPlatform(
          connectionRequest,
          "instagram",
        )
      ) {
        return NextResponse.redirect(
          appUrl("/connect/instagram/error?reason=request"),
          303,
        );
      }

      const state = await createInstagramOauthState({
        clientId: connectionRequest.clientId,
        requestId: connectionRequest._id,
        mode: "request",
      });
      const response = NextResponse.redirect(
        createInstagramAuthorizationUrl(state),
        303,
      );
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }

    if (!(await getSession())) {
      return NextResponse.redirect(appUrl("/login"), 303);
    }

    const clientId = url.searchParams.get("clientId");
    const state = await createInstagramOauthState({
      clientId,
      mode: "owner",
    });
    const response = NextResponse.redirect(
      createInstagramAuthorizationUrl(state),
      303,
    );
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return apiError(error, "Unable to begin Instagram authorization.");
  }
}
