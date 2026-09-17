import { apiError, readJson } from "@/lib/api";
import { getClientById, updateClient } from "@/lib/data";
import { requireApiSession } from "@/lib/session";
import { hasValidationErrors, validateClientInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const client = await getClientById(id);

    return client
      ? Response.json({ client })
      : Response.json({ error: "Client not found." }, { status: 404 });
  } catch (error) {
    return apiError(error, "Unable to load the client.");
  }
}

export async function PATCH(request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await readJson(request);
    const { data, errors } = validateClientInput(body);

    if (hasValidationErrors(errors)) {
      return Response.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
    }

    const client = await updateClient(id, data);
    return client
      ? Response.json({ client })
      : Response.json({ error: "Client not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return apiError(error, "Unable to update the client.");
  }
}
