import { apiError } from "@/lib/api";
import { getDb } from "@/lib/mongodb";
import { toObjectId } from "@/lib/ids";
import {
  PublishConflictError,
  PublishProviderError,
  checkFacebookVideoPublishStatus,
  publishFacebookTextLinkVersion,
} from "@/lib/publishing";
import {
  InstagramPublishConflictError,
  InstagramPublishProviderError,
  checkInstagramPublishStatus,
  publishInstagramSingleImageVersion,
} from "@/lib/instagram-publishing";
import {
  checkInstagramCarouselPublishStatus,
  publishInstagramCarouselVersion,
} from "@/lib/instagram-carousel-publishing";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function publishErrorResponse(error) {
  if (
    error instanceof PublishConflictError ||
    error instanceof InstagramPublishConflictError
  ) {
    return Response.json(
      { error: error.message, attempt: error.attempt },
      { status: 409 },
    );
  }

  if (
    error instanceof PublishProviderError ||
    error instanceof InstagramPublishProviderError
  ) {
    return Response.json(
      { error: error.message, attempt: error.attempt },
      { status: 502 },
    );
  }

  if (error instanceof TypeError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return null;
}

async function getPublishTarget(id) {
  const platformVersionId = toObjectId(id);
  if (!platformVersionId) return null;

  const db = await getDb();
  const version = await db.collection("platform_versions").findOne(
    { _id: platformVersionId, active: { $ne: false } },
    {
      projection: {
        platform: 1,
        mediaIds: 1,
        lastPublishAttemptId: 1,
      },
    },
  );

  if (!version) return null;

  let attemptMode = "";
  if (version.lastPublishAttemptId) {
    const attempt = await db.collection("publish_attempts").findOne(
      { _id: version.lastPublishAttemptId },
      { projection: { publishMode: 1 } },
    );
    attemptMode = String(attempt?.publishMode || "");
  }

  return {
    platform: String(version.platform || ""),
    mediaCount: Array.isArray(version.mediaIds) ? version.mediaIds.length : 0,
    attemptMode,
  };
}

export async function POST(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const target = await getPublishTarget(id);

    if (target?.platform === "instagram") {
      return Response.json(
        target.mediaCount >= 2
          ? await publishInstagramCarouselVersion(id)
          : await publishInstagramSingleImageVersion(id),
      );
    }

    if (target?.platform === "facebook") {
      return Response.json(await publishFacebookTextLinkVersion(id));
    }

    return Response.json({ error: "Platform version not found." }, { status: 404 });
  } catch (error) {
    return (
      publishErrorResponse(error) ||
      apiError(error, "Unable to publish this platform version.")
    );
  }
}

export async function GET(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const target = await getPublishTarget(id);

    if (target?.platform === "instagram") {
      return Response.json(
        target.attemptMode === "carousel"
          ? await checkInstagramCarouselPublishStatus(id)
          : await checkInstagramPublishStatus(id),
      );
    }

    if (target?.platform === "facebook") {
      return Response.json(await checkFacebookVideoPublishStatus(id));
    }

    return Response.json({ error: "Platform version not found." }, { status: 404 });
  } catch (error) {
    return (
      publishErrorResponse(error) ||
      apiError(error, "Unable to refresh this publish status.")
    );
  }
}
