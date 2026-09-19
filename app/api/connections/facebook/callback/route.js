import { NextResponse } from "next/server";
import {
  consumeFacebookOauthState,
  createFacebookSelectionFlow,
} from "@/lib/connections";
import {
  exchangeFacebookCode,
  FacebookApiError,
  getFacebookPermissionStatuses,
  getFacebookRequiredPermissions,
  inspectFacebookToken,
  listFacebookPages,
} from "@/lib/facebook";
import { getAppBaseUrl } from "@/lib/env";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function appUrl(pathname) {
  return new URL(pathname, getAppBaseUrl());
}

function errorRedirect(reason) {
  const url = appUrl("/connect/facebook/error");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url, 303);
}

function safeFacebookError(error) {
  const details = error instanceof FacebookApiError ? error.details : null;

  return {
    message: error?.message || "Facebook returned an unexpected response.",
    type: details?.type || "",
    code: details?.code ?? null,
    subcode: details?.error_subcode ?? null,
    traceId: details?.fbtrace_id || "",
  };
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
    const state = await consumeFacebookOauthState(stateValue);

    if (!state) {
      return errorRedirect("expired");
    }

    if (state.mode === "owner" && !(await getSession())) {
      return NextResponse.redirect(appUrl("/login"), 303);
    }

    const token = await exchangeFacebookCode(code);
    const [permissionResult, pageResult, tokenResult] = await Promise.allSettled([
      getFacebookPermissionStatuses(token.access_token),
      listFacebookPages(token.access_token),
      inspectFacebookToken(token.access_token),
    ]);
    const permissionStatuses =
      permissionResult.status === "fulfilled" ? permissionResult.value : [];
    const permissions = permissionStatuses
      .filter((permission) => permission.status === "granted")
      .map((permission) => permission.permission);
    const pages = pageResult.status === "fulfilled" ? pageResult.value : [];
    const tokenDetails =
      tokenResult.status === "fulfilled" ? tokenResult.value : null;
    const diagnostics = {
      requestedPermissions: getFacebookRequiredPermissions(),
      permissionStatuses,
      tokenIsValid: tokenDetails?.isValid ?? null,
      tokenScopes: tokenDetails?.scopes || [],
      pageCount: pages.length,
      permissionsError:
        permissionResult.status === "rejected"
          ? safeFacebookError(permissionResult.reason)
          : null,
      pagesError:
        pageResult.status === "rejected"
          ? safeFacebookError(pageResult.reason)
          : null,
      tokenInspectionError:
        tokenResult.status === "rejected"
          ? safeFacebookError(tokenResult.reason)
          : null,
    };

    console.info("Facebook OAuth diagnostic summary", {
      clientId: state.clientId,
      mode: state.mode,
      diagnostics,
    });

    const selectionToken = await createFacebookSelectionFlow({
      clientId: state.clientId,
      requestId: state.requestId,
      mode: state.mode,
      pages,
      permissions,
      diagnostics,
    });
    const selectionUrl = appUrl("/connect/facebook/select");
    selectionUrl.searchParams.set("token", selectionToken);
    const response = NextResponse.redirect(selectionUrl, 303);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    console.error(error);
    return errorRedirect("provider");
  }
}
