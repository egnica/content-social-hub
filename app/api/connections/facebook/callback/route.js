import {
  consumeFacebookOauthState,
  createFacebookSelectionFlow,
} from "@/lib/connections";
import {
  exchangeFacebookCode,
  getFacebookPermissions,
  listFacebookPages,
} from "@/lib/facebook";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function errorRedirect(request, reason) {
  const url = new URL("/connect/facebook/error", request.url);
  url.searchParams.set("reason", reason);
  return Response.redirect(url, 303);
}

export async function GET(request) {
  const url = new URL(request.url);
  const stateValue = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  if (url.searchParams.get("error")) {
    return errorRedirect(request, "cancelled");
  }

  if (!stateValue || !code) {
    return errorRedirect(request, "invalid");
  }

  try {
    const state = await consumeFacebookOauthState(stateValue);

    if (!state) {
      return errorRedirect(request, "expired");
    }

    if (state.mode === "owner" && !(await getSession())) {
      return Response.redirect(new URL("/login", request.url), 303);
    }

    const token = await exchangeFacebookCode(code);
    const [permissions, pages] = await Promise.all([
      getFacebookPermissions(token.access_token),
      listFacebookPages(token.access_token),
    ]);
    const selectionToken = await createFacebookSelectionFlow({
      clientId: state.clientId,
      requestId: state.requestId,
      mode: state.mode,
      pages,
      permissions,
    });
    const selectionUrl = new URL("/connect/facebook/select", request.url);
    selectionUrl.searchParams.set("token", selectionToken);
    const response = Response.redirect(selectionUrl, 303);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    console.error(error);
    return errorRedirect(request, "provider");
  }
}
