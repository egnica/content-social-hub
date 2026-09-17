import { apiError, readJson } from "@/lib/api";
import { getContentById, updateContent } from "@/lib/data";
import { requireApiSession } from "@/lib/session";
import { hasValidationErrors, validateContentInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const content = await getContentById(id);

    return content
      ? Response.json({ content })
      : Response.json({ error: "Content not found." }, { status: 404 });
  } catch (error) {
    return apiError(error, "Unable to load content.");
  }
}

export async function PATCH(request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await readJson(request);
    const { data, errors } = validateContentInput(body);

    if (hasValidationErrors(errors)) {
      return Response.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
    }

    const content = await updateContent(id, data);
    return content
      ? Response.json({ content })
      : Response.json({ error: "Content not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return apiError(error, "Unable to update content.");
  }
}
