import { readJson, apiError } from "@/lib/api";
import { completeYouTubeSelection } from "@/lib/connections";
import { requireApiSession } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function POST(request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  try {
    const body = await readJson(request);
    return Response.json({ connection: await completeYouTubeSelection(body?.token) });
  } catch (error) {
    if (error instanceof TypeError) return Response.json({ error: error.message }, { status: 400 });
    return apiError(error, "Unable to save YouTube connection.");
  }
}
