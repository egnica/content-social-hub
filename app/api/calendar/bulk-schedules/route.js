import { apiError } from "@/lib/api";
import { MAX_BULK_FILE_BYTES, previewBulkFile } from "@/lib/bulk-calendar-preview";
import { BULK_SCHEDULE_BATCH_SIZE } from "@/lib/bulk-schedule-logic";
import { reviewBulkScheduleRow, scheduleBulkRow } from "@/lib/bulk-schedule";
import { listSocialConnections } from "@/lib/connections";
import { getClientById } from "@/lib/data";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  try {
    const form = await request.formData();
    const action = form.get("action");
    if (!["review", "schedule"].includes(action)) throw new TypeError("Choose review or schedule.");
    if (action === "schedule" && process.env.BULK_SCHEDULE_WRITES_ENABLED !== "true") {
      return Response.json({ error: "Bulk scheduling is disabled pending verification." }, { status: 503 });
    }
    if (action === "schedule" && form.get("confirm") !== "schedule_reviewed") {
      throw new TypeError("Explicit scheduling confirmation is required.");
    }
    const client = await getClientById(form.get("clientId"));
    if (!client || client.status !== "active") throw new TypeError("Choose one active client.");
    const file = form.get("file");
    if (!(file instanceof File) || !/\.(csv|xlsx)$/i.test(file.name) || !file.size || file.size > MAX_BULK_FILE_BYTES) {
      throw new TypeError("Choose a nonempty .csv or .xlsx file up to 2 MB.");
    }
    const connections = await listSocialConnections({ clientId: client._id });
    const preview = await previewBulkFile(Buffer.from(await file.arrayBuffer()), { filename: file.name, client, connections });
    if (!preview.valid) return Response.json({ error: "The source file is no longer valid. Review the corrected file first.", preview }, { status: 422 });
    const rawOffset = form.get("offset");
    const offset = Number(rawOffset);
    if (!/^(0|[1-9]\d*)$/.test(String(rawOffset)) || !Number.isSafeInteger(offset) || offset >= preview.posts.length) {
      throw new TypeError("Invalid batch position.");
    }
    let keys = [];
    if (action === "schedule") {
      try { keys = JSON.parse(String(form.get("approvedKeys") || "")); } catch { throw new TypeError("Invalid confirmed review."); }
      if (!Array.isArray(keys) || keys.length > 2000 || keys.some(k => typeof k !== "string" || !/^[a-f0-9]{64}$/.test(k))) {
        throw new TypeError("Invalid confirmed review.");
      }
    }
    const approved = new Set(keys);
    const end = Math.min(offset + BULK_SCHEDULE_BATCH_SIZE, preview.posts.length);
    const results = [];
    for (const post of preview.posts.slice(offset, end)) {
      results.push(action === "review" ? await reviewBulkScheduleRow(post, client, connections) :
        await scheduleBulkRow(post, client, connections, approved));
    }
    return Response.json({ results, nextOffset: end, total: preview.posts.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TypeError) return Response.json({ error: error.message }, { status: 400 });
    return apiError(error, "Unable to process bulk scheduling.");
  }
}
