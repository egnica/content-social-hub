import { apiError } from "@/lib/api";
import { checkDatabaseConnection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkDatabaseConnection();

    return Response.json({
      status: "ok",
      database: "connected",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error, "The application health check failed.");
  }
}
