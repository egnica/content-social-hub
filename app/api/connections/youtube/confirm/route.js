import { readJson, apiError } from "@/lib/api";
import { completeYouTubeSelection, getYouTubeSelectionFlow } from "@/lib/connections";
import { requireApiSession } from "@/lib/session";
export const dynamic = "force-dynamic";
export async function POST(request) {
  try {
    const body = await readJson(request);
    const flow = await getYouTubeSelectionFlow(body?.token);
    if (!flow) return Response.json({ error: "This YouTube confirmation expired." }, { status: 400 });
    if (flow.mode === "owner") {
      const unauthorized = await requireApiSession();
      if (unauthorized) return unauthorized;
    } else if (flow.mode !== "request") {
      return Response.json({ error: "Invalid YouTube connection flow." }, { status: 403 });
    }
    return Response.json({ connection: await completeYouTubeSelection(body?.token) });
  } catch (error) {
    if (error instanceof TypeError) return Response.json({ error: error.message }, { status: 400 });
    return apiError(error, "Unable to save YouTube connection.");
  }
}
