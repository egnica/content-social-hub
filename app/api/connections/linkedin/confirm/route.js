import { apiError, readJson } from "@/lib/api";
import { completeLinkedInSelection, getLinkedInSelectionFlow } from "@/lib/connections";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export async function POST(request) {
  try {
    const body = await readJson(request);
    const flow = await getLinkedInSelectionFlow(body?.token);
    if (!flow) return Response.json({ error: "This LinkedIn confirmation expired." }, { status: 400 });
    if (flow.mode === "owner") {
      const unauthorized = await requireApiSession();
      if (unauthorized) return unauthorized;
    } else if (flow.mode !== "request") {
      return Response.json({ error: "Invalid connection flow." }, { status: 403 });
    }
    const connection = await completeLinkedInSelection(body?.token);
    return Response.json({ connection });
  } catch (error) {
    if (error instanceof TypeError) return Response.json({ error: error.message }, { status: 400 });
    return apiError(error, "Unable to save LinkedIn connection.");
  }
}
