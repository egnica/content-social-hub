import { apiError } from "@/lib/api";
import { BULK_DRAFT_BATCH_SIZE } from "@/lib/bulk-draft-logic";
import { importBulkDraftRow } from "@/lib/bulk-draft-import";
import { MAX_BULK_FILE_BYTES, previewBulkWorkbook } from "@/lib/bulk-calendar-preview";
import { listSocialConnections } from "@/lib/connections";
import { getClientById } from "@/lib/data";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Deliberately off until the documented six baseline failures and full
// Node 24/lint/build verification have been resolved. Pushing code is not
// authorization to create bulk database/media writes in production.
export async function POST(request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  if (process.env.BULK_DRAFT_WRITES_ENABLED !== "true") {
    return Response.json({
      error: "Bulk draft creation is not enabled until the required automated verification is complete.",
    }, { status: 503 });
  }
  try {
    const form = await request.formData();
    if (form.get("confirm") !== "create_drafts") {
      return Response.json({ error: "Explicit draft creation confirmation is required." }, { status: 400 });
    }
    const clientId = form.get("clientId");
    const client = await getClientById(clientId);
    if (!client || client.status !== "active") {
      return Response.json({ error: "Choose one active client before creating drafts." }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") ||
        !file.size || file.size > MAX_BULK_FILE_BYTES) {
      return Response.json({ error: "Choose a nonempty .xlsx file up to 2 MB." }, { status: 400 });
    }
    const connections = await listSocialConnections({ clientId: client._id });
    const preview = await previewBulkWorkbook(Buffer.from(await file.arrayBuffer()), { client, connections });
    if (!preview.valid) {
      return Response.json({
        error: "The workbook or selected accounts changed. Correct every preview error before creating drafts.",
        preview,
      }, { status: 422 });
    }
    const rawOffset = form.get("offset");
    const offset = Number(rawOffset);
    if (!/^(0|[1-9]\d*)$/.test(String(rawOffset)) || !Number.isSafeInteger(offset) ||
        offset >= preview.posts.length) {
      return Response.json({ error: "Invalid batch position." }, { status: 400 });
    }

    const end = Math.min(offset + BULK_DRAFT_BATCH_SIZE, preview.posts.length);
    const results = [];
    for (const post of preview.posts.slice(offset, end)) {
      try {
        results.push(await importBulkDraftRow(post, client._id, connections));
      } catch (error) {
        results.push({
          row: post.row, post_key: post.post_key, title: post.title, status: "error",
          error: error instanceof TypeError ?
            error.message : "This draft could not be created. Retry after checking the source and account.",
        });
      }
    }
    return Response.json({
      results, nextOffset: end, complete: end === preview.posts.length,
      total: preview.posts.length,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof TypeError) return Response.json({ error: error.message }, { status: 400 });
    return apiError(error, "Unable to create bulk drafts.");
  }
}
