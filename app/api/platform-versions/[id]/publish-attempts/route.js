import { apiError } from "@/lib/api";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const platformVersionId = toObjectId(id);

    if (!platformVersionId) {
      return Response.json({ error: "Platform version not found." }, { status: 404 });
    }

    const db = await getDb();
    const version = await db.collection("platform_versions").findOne({
      _id: platformVersionId,
      platform: { $in: ["facebook", "instagram"] },
    });

    if (!version) {
      return Response.json({ error: "Platform version not found." }, { status: 404 });
    }

    const attempts = await db
      .collection("publish_attempts")
      .find({ platformVersionId })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    return Response.json({
      platform: version.platform,
      attempts: attempts.map((attempt) => serializeDocument(attempt)),
    });
  } catch (error) {
    return apiError(error, "Unable to load publish history.");
  }
}
