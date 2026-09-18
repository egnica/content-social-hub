import { apiError, readJson } from "@/lib/api";
import { completeFacebookSelection } from "@/lib/connections";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await readJson(request);
    const connection = await completeFacebookSelection(
      body?.token,
      body?.providerAccountId,
    );

    return Response.json({ connection });
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return apiError(error, "Unable to save the Facebook Page connection.");
  }
}
