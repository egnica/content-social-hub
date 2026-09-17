import { apiError, readJson } from "@/lib/api";
import { createClient, listClients } from "@/lib/data";
import { requireApiSession } from "@/lib/session";
import { hasValidationErrors, validateClientInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    return Response.json({ clients: await listClients() });
  } catch (error) {
    return apiError(error, "Unable to load clients.");
  }
}

export async function POST(request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const body = await readJson(request);
    const { data, errors } = validateClientInput(body);

    if (hasValidationErrors(errors)) {
      return Response.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
    }

    return Response.json({ client: await createClient(data) }, { status: 201 });
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return apiError(error, "Unable to create the client.");
  }
}
