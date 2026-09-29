import { apiError } from "@/lib/api";
import { fetchLinkPreviewMetadata } from "@/lib/link-preview";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const requestUrl = new URL(request.url);
    const destinationUrl = requestUrl.searchParams.get("url");

    if (!destinationUrl) {
      return Response.json(
        { error: "Choose a destination URL to preview." },
        { status: 400 },
      );
    }

    return Response.json({
      preview: await fetchLinkPreviewMetadata(destinationUrl),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return apiError(error, "Unable to load link preview metadata.");
  }
}
