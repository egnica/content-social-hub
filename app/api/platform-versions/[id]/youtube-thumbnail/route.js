import { apiError } from "@/lib/api";
import { requireApiSession } from "@/lib/session";
import { checkYouTubeThumbnail, YouTubePublishConflictError } from "@/lib/youtube-publishing";

export const dynamic = "force-dynamic";

// Reads videos.list snippet.thumbnails for an existing client-owned YouTube video.
// Does not call thumbnails.set or submit/upload any media.
export async function POST(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    return Response.json(await checkYouTubeThumbnail(id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof YouTubePublishConflictError)
      return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof TypeError)
      return Response.json({ error: error.message }, { status: 400 });
    return apiError(error, "Unable to check the YouTube thumbnail.");
  }
}
