import { apiError } from "@/lib/api";
import { getMediaById } from "@/lib/data";
import { requireApiSession } from "@/lib/session";
import { createMediaViewUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const media = await getMediaById(id);

    if (!media) {
      return Response.json({ error: "Media not found." }, { status: 404 });
    }

    return Response.redirect(await createMediaViewUrl(media.objectKey), 307);
  } catch (error) {
    return apiError(error, "Unable to open the media file.");
  }
}
