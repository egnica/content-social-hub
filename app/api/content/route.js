import { apiError, readJson } from "@/lib/api";
import { createContent, listContent } from "@/lib/data";
import { requireApiSession } from "@/lib/session";
import { hasValidationErrors, validateContentInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const items = await listContent({
      clientId: url.searchParams.get("client") || "",
      reusable: url.searchParams.get("reusable") === "true",
    });

    return Response.json({ content: items });
  } catch (error) {
    return apiError(error, "Unable to load content.");
  }
}

export async function POST(request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const body = await readJson(request);
    const { data, errors } = validateContentInput(body);

    if (hasValidationErrors(errors)) {
      return Response.json({ error: "Check the highlighted fields.", errors }, { status: 400 });
    }

    return Response.json({ content: await createContent(data) }, { status: 201 });
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return apiError(error, "Unable to save content.");
  }
}
