import { apiError } from "@/lib/api";
import { refreshSocialConnectionHealth } from "@/lib/connections";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Owner-only verification: renew the stored YouTube access token immediately.
// Never return access or refresh token values to the browser.
export async function POST(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const connection = await refreshSocialConnectionHealth(id, { forceYouTubeRefresh: true });
    return connection
      ? Response.json({ connection })
      : Response.json({ error: "Connection not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiError(error, "Unable to refresh YouTube authorization.");
  }
}
