import { apiError } from "@/lib/api";
import { createBulkCsvTemplate, createBulkTemplate, MAX_BULK_FILE_BYTES, previewBulkFile } from "@/lib/bulk-calendar-preview";
import { listSocialConnections } from "@/lib/connections";
import { getClientById } from "@/lib/data";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function selectedClient(id) {
  const client = await getClientById(id);
  return client?.status === "active" ? client : null;
}

export async function GET(request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  const client = await selectedClient(new URL(request.url).searchParams.get("client"));
  if (!client) return Response.json({ error: "Choose an active client first." }, { status: 400 });
  try {
    const connections = await listSocialConnections({ clientId: client._id });
    const url = new URL(request.url);
    if (url.searchParams.get("format") === "csv") {
      const sample = url.searchParams.get("sample") === "1";
      const csv = createBulkCsvTemplate({ client, connections }, { sample });
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": sample ? 'attachment; filename="calendar-bulk-example.csv"' : 'attachment; filename="calendar-bulk-template.csv"',
          "Cache-Control": "no-store",
        },
      });
    }
    const workbook = createBulkTemplate({ client, connections });
    const data = await workbook.xlsx.writeBuffer();
    return new Response(data, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="calendar-bulk-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof TypeError) return Response.json({ error: error.message }, { status: 400 });
    return apiError(error, "Unable to create template.");
  }
}

export async function POST(request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  try {
    const form = await request.formData();
    const client = await selectedClient(form.get("clientId"));
    if (!client) return Response.json({ error: "Choose an active client first." }, { status: 400 });
    const file = form.get("file");
    if (!(file instanceof File) || !/\.(csv|xlsx)$/i.test(file.name) || !file.size || file.size > MAX_BULK_FILE_BYTES) {
      return Response.json({ error: "Choose a nonempty .csv or .xlsx file up to 2 MB." }, { status: 400 });
    }
    const connections = await listSocialConnections({ clientId: client._id });
    const preview = await previewBulkFile(Buffer.from(await file.arrayBuffer()), { filename: file.name, client, connections });
    return Response.json({ preview });
  } catch (error) {
    if (error instanceof TypeError) return Response.json({ error: error.message }, { status: 400 });
    return apiError(error, "Unable to preview workbook.");
  }
}
