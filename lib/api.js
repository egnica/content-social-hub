import { ConfigurationError } from "@/lib/env";

export function apiError(error, fallbackMessage = "Something went wrong.") {
  if (error instanceof ConfigurationError) {
    return Response.json(
      {
        error: "Application configuration is incomplete.",
        missing: error.variableName,
      },
      { status: 503 },
    );
  }

  if (error?.name === "MongoServerSelectionError") {
    return Response.json(
      { error: "The database could not be reached." },
      { status: 503 },
    );
  }

  console.error(error);
  return Response.json({ error: fallbackMessage }, { status: 500 });
}

export async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new TypeError("Expected an application/json request body.");
  }

  try {
    return await request.json();
  } catch {
    throw new TypeError("The request body contains invalid JSON.");
  }
}
