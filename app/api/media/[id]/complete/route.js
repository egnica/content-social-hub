import { apiError } from "@/lib/api";
import {
  completeMediaUpload,
  getPendingMediaById,
} from "@/lib/data";
import { requireApiSession } from "@/lib/session";
import { createMediaViewUrl, verifyMediaObject } from "@/lib/s3";

export async function POST(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const pendingMedia = await getPendingMediaById(id);

    if (!pendingMedia) {
      return Response.json({ error: "Pending media was not found." }, { status: 404 });
    }

    await verifyMediaObject(pendingMedia.objectKey);
    const media = await completeMediaUpload(id);
    const previewUrl = await createMediaViewUrl(media.objectKey);

    return Response.json({ media: { ...media, previewUrl } });
  } catch (error) {
    return apiError(error, "Unable to confirm the media upload.");
  }
}
