import { apiError } from "@/lib/api";
import { requireApiSession } from "@/lib/session";
import { checkYouTubeSavedUploadSession, YouTubePublishConflictError } from "@/lib/youtube-publishing";

export const dynamic = "force-dynamic";

// Owner-only diagnostic action. The provider request has an empty body and
// Content-Range "bytes */size". It NEVER starts an upload or sends video bytes.
export async function POST(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const result = await checkYouTubeSavedUploadSession(id);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof YouTubePublishConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return apiError(error, "Unable to check the saved YouTube upload session.");
  }
}
