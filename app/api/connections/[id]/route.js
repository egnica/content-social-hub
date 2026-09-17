import { apiError } from "@/lib/api";
import { deleteSocialConnection } from "@/lib/connections";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function DELETE(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const connection = await deleteSocialConnection(id);

    return connection
      ? Response.json({ connection })
      : Response.json({ error: "Connection not found." }, { status: 404 });
  } catch (error) {
    return apiError(error, "Unable to disconnect this social account.");
  }
}
