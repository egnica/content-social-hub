import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import {
  createFacebookOauthState,
  getConnectionRequestByToken,
} from "@/lib/connections";
import { createFacebookAuthorizationUrl } from "@/lib/facebook";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const requestToken = url.searchParams.get("requestToken");

    if (requestToken) {
      const connectionRequest = await getConnectionRequestByToken(requestToken);

      if (!connectionRequest || connectionRequest.status !== "pending") {
        return NextResponse.redirect(
          new URL("/connect/facebook/error?reason=request", request.url),
          303,
        );
      }

      const state = await createFacebookOauthState({
        clientId: connectionRequest.clientId,
        requestId: connectionRequest._id,
        mode: "request",
      });
      const response = NextResponse.redirect(
        createFacebookAuthorizationUrl(state),
        303,
      );
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }

    if (!(await getSession())) {
      return NextResponse.redirect(new URL("/login", request.url), 303);
    }

    const clientId = url.searchParams.get("clientId");
    const state = await createFacebookOauthState({
      clientId,
      mode: "owner",
    });
    const response = NextResponse.redirect(
      createFacebookAuthorizationUrl(state),
      303,
    );
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return apiError(error, "Unable to begin Facebook authorization.");
  }
}
