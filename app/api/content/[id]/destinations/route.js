import { apiError, readJson } from "@/lib/api";
import {
  getPlatformDestinationState,
  syncPlatformVersionSelection,
} from "@/lib/platform-versions";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const state = await getPlatformDestinationState(id);

    return state
      ? Response.json(state)
      : Response.json({ error: "Content not found." }, { status: 404 });
  } catch (error) {
    return apiError(error, "Unable to load publishing destinations.");
  }
}

export async function PUT(request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await readJson(request);

    if (!Array.isArray(body?.socialConnectionIds)) {
      return Response.json(
        { error: "Choose the Facebook destinations to save." },
        { status: 400 },
      );
    }

    return Response.json(
      await syncPlatformVersionSelection(id, body.socialConnectionIds),
    );
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return apiError(error, "Unable to save publishing destinations.");
  }
}
