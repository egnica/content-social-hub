import { apiError } from "@/lib/api";
import {
  PublishConflictError,
  PublishProviderError,
  checkFacebookVideoPublishStatus,
  publishFacebookTextLinkVersion,
} from "@/lib/publishing";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function publishErrorResponse(error) {
  if (error instanceof PublishConflictError) {
    return Response.json(
      { error: error.message, attempt: error.attempt },
      { status: 409 },
    );
  }

  if (error instanceof PublishProviderError) {
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

export async function POST(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    return Response.json(await publishFacebookTextLinkVersion(id));
  } catch (error) {
    return (
      publishErrorResponse(error) ||
      apiError(error, "Unable to publish this Facebook version.")
    );
  }
}

export async function GET(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    return Response.json(await checkFacebookVideoPublishStatus(id));
  } catch (error) {
    return (
      publishErrorResponse(error) ||
      apiError(error, "Unable to refresh Facebook video status.")
    );
  }
}
