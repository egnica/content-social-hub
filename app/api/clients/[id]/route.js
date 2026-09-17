import { apiError, readJson } from "@/lib/api";
import {
  deleteClientIfEmpty,
  getClientById,
  updateClient,
} from "@/lib/data";
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

export async function DELETE(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const result = await deleteClientIfEmpty(id);

    if (result.status === "not_found") {
      return Response.json({ error: "Client not found." }, { status: 404 });
    }

    if (result.status === "has_content") {
      const label = result.contentCount === 1 ? "package" : "packages";
      return Response.json(
        {
          error: `This client has ${result.contentCount} saved Content ${label}. Archive the client or delete its Content first.`,
          contentCount: result.contentCount,
        },
        { status: 409 },
      );
    }

    return Response.json({ client: result.client });
  } catch (error) {
    return apiError(error, "Unable to delete the client.");
  }
}
