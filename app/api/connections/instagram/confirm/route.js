import { apiError, readJson } from "@/lib/api";
import { completeInstagramSelection } from "@/lib/connections";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const body = await readJson(request);
    const connection = await completeInstagramSelection(body?.token);
    return Response.json({ connection });
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return apiError(error, "Unable to save the Instagram connection.");
  }
}
