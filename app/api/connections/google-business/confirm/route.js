import { cookies } from "next/headers";
import { readJson, apiError } from "@/lib/api";
import { completeGoogleBusinessSelection } from "@/lib/connections";
import { GoogleBusinessApiError } from "@/lib/google-business";
import { GOOGLE_BUSINESS_SELECTION_COOKIE, matchesGoogleBusinessBrowser } from "@/lib/google-business-oauth-browser";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function POST(request) {
  try {
    const unauthorized = await requireApiSession();
    if (unauthorized) return unauthorized;
    const body = await readJson(request);
    if (!await matchesGoogleBusinessBrowser(GOOGLE_BUSINESS_SELECTION_COOKIE, body?.token)) {
      return Response.json({ error: "Restart Google Business Connect in this browser." }, { status: 403 });
    }
    const connection = await completeGoogleBusinessSelection(body.token, body.providerParent);
    (await cookies()).delete(GOOGLE_BUSINESS_SELECTION_COOKIE);
    return Response.json({ connection }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TypeError || error instanceof GoogleBusinessApiError) {
      return Response.json({ error: `${error.message} If this confirmation was already submitted, restart Connect.` }, { status: 400 });
    }
    return apiError(error, "Unable to save Google Business connection. Restart Connect and try again.");
  }
}
