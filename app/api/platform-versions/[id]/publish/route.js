import { apiError } from "@/lib/api";
import {
  PublishConflictError,
  PublishProviderError,
  publishFacebookTextLinkVersion,
} from "@/lib/publishing";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    return Response.json(await publishFacebookTextLinkVersion(id));
  } catch (error) {
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

    return apiError(error, "Unable to publish this Facebook version.");
  }
}
