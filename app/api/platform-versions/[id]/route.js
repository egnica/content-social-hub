import { apiError, readJson } from "@/lib/api";
import {
  resetPlatformVersionFromMaster,
  savePlatformVersion,
} from "@/lib/platform-versions";
import { assertDestinationNotDispatching } from "@/lib/scheduled-release-guard";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    await assertDestinationNotDispatching(id);
    const body = await readJson(request);

    if (body?.action === "reset_from_master") {
      return Response.json({
        platformVersion: await resetPlatformVersionFromMaster(id),
      });
    }

    return Response.json({
      platformVersion: await savePlatformVersion(id, {
        message: body?.message,
        destinationUrl: body?.destinationUrl,
        caption: body?.caption,
        mediaIds: body?.mediaIds,
        primaryMediaId: body?.primaryMediaId,
        videoThumbnailMediaId: body?.videoThumbnailMediaId,
      }),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return apiError(error, "Unable to save the platform version.");
  }
}
