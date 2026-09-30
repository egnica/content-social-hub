import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { createInstagramOauthState } from "@/lib/connections";
import { getAppBaseUrl } from "@/lib/env";
import { createInstagramAuthorizationUrl } from "@/lib/instagram";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function appUrl(pathname) {
  return new URL(pathname, getAppBaseUrl());
}

export async function GET(request) {
  try {
    if (!(await getSession())) {
      return NextResponse.redirect(appUrl("/login"), 303);
    }

    const url = new URL(request.url);
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
