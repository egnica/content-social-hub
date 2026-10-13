import { NextResponse } from "next/server";
import { consumeYouTubeOauthState, createYouTubeSelectionFlow } from "@/lib/connections";
import { getAppBaseUrl } from "@/lib/env";
import { exchangeYouTubeCode, getAuthorizedYouTubeChannel } from "@/lib/youtube";
import { assertSameYouTubeChannel } from "@/lib/youtube-connection-logic";
import { getSession } from "@/lib/session";
export const dynamic = "force-dynamic";
const urlFor = path => new URL(path, getAppBaseUrl());
function fail(reason) { const url = urlFor("/connect/youtube/error"); url.searchParams.set("reason", reason); return NextResponse.redirect(url, 303); }
export async function GET(request) {
  const url = new URL(request.url);
  const stateValue = url.searchParams.get("state");
  if (!stateValue) return fail("invalid");
  try {
    const state = await consumeYouTubeOauthState(stateValue);
    if (!state) return fail("expired");
    if (!(await getSession())) return NextResponse.redirect(urlFor("/login"), 303);
    if (url.searchParams.get("error")) return fail("cancelled");
    const code = url.searchParams.get("code");
    if (!code) return fail("invalid");
    const tokens = await exchangeYouTubeCode(code);
    const channel = await getAuthorizedYouTubeChannel(tokens.accessToken);
    assertSameYouTubeChannel(state.expectedProviderAccountId, channel.providerAccountId);
    const token = await createYouTubeSelectionFlow({ state, channel, tokens });
    const target = urlFor("/connect/youtube/confirm");
    target.searchParams.set("token", token);
    const response = NextResponse.redirect(target, 303);
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("YouTube OAuth callback failed", { name: error?.name || "Error", status: error?.status || null });
    return fail(error instanceof TypeError ? "identity" : "provider");
  }
}
