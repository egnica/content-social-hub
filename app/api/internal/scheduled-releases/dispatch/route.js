import { createHash, timingSafeEqual } from "node:crypto";
import { apiError, readJson } from "@/lib/api";
import { dispatchScheduledRelease } from "@/lib/scheduled-release-dispatch";
import { runInstagramMaintenance } from "@/lib/instagram-maintenance";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

function authorized(request) {
  const expected = String(
    process.env.SCHEDULED_RELEASE_DISPATCH_TOKEN_SHA256 || "",
  )
    .trim()
    .toLowerCase();
  const authorization = String(request.headers.get("authorization") || "");
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!/^[0-9a-f]{64}$/.test(expected) || !token) return false;

  const actual = createHash("sha256").update(token).digest("hex");
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export async function POST(request) {
  if (!authorized(request)) {
    return Response.json(
      { error: "Unauthorized scheduled release worker." },
      { status: 401 },
    );
  }

  try {
    const body = await readJson(request);
    if (body?.action === "instagram_maintenance") {
      return Response.json(await runInstagramMaintenance());
    }
    if (body?.action)
      return Response.json(
        { error: "Unsupported worker action." },
        { status: 400 },
      );
    return Response.json(
      await dispatchScheduledRelease(body?.scheduledReleaseId),
    );
  } catch (error) {
    return apiError(error, "Unable to dispatch the scheduled release.");
  }
}
