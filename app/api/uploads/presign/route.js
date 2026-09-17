import { apiError, readJson } from "@/lib/api";
import { createPendingMedia } from "@/lib/data";
import { requireApiSession } from "@/lib/session";
import {
  createObjectKey,
  createUploadUrl,
  validateMediaUpload,
} from "@/lib/s3";

function safeMetric(value, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= max ? number : null;
}

export async function POST(request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const body = await readJson(request);
    const filename = String(body.filename || "").trim().slice(0, 255);
    const contentType = String(body.contentType || "").trim().toLowerCase();
    const size = Number(body.size);
    const clientId = String(body.clientId || "").trim();
    const validationError = validateMediaUpload({ contentType, size });

    if (!clientId || !filename || validationError) {
      return Response.json(
        { error: validationError || "Client and filename are required." },
        { status: 400 },
      );
    }

    const objectKey = createObjectKey(clientId, filename);
    const uploadUrl = await createUploadUrl({ objectKey, contentType });
    const media = await createPendingMedia({
      clientId,
      objectKey,
      originalName: filename,
      contentType,
      size,
      width: safeMetric(body.width, 100_000),
      height: safeMetric(body.height, 100_000),
      duration: safeMetric(body.duration, 86_400),
      aspectRatio: safeMetric(body.aspectRatio, 1_000),
      orientation: ["landscape", "portrait", "square"].includes(body.orientation)
        ? body.orientation
        : null,
    });

    return Response.json({
      media,
      uploadUrl,
      headers: {
        "Content-Type": contentType,
        "x-amz-server-side-encryption": "AES256",
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return apiError(error, "Unable to prepare the media upload.");
  }
}
