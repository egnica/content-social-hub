import assert from "node:assert/strict";
import test from "node:test";
import {
  bulkAccountColumns, createBulkCsvTemplate, createBulkTemplate,
  previewBulkCsv, previewBulkFile, previewBulkWorkbook,
} from "../lib/bulk-calendar-preview.js";
import { parseCsvRows, stringifyCsvRows } from "../lib/bulk-csv.js";

const client = { _id: "client-a", name: "Client A", status: "active", timezone: "America/Chicago" };
const connections = [
  { _id: "account-a", clientId: "client-a", platform: "facebook", accountName: "Page A" },
  { _id: "account-g", clientId: "client-a", platform: "google_business_profile", accountName: "Location A" },
  { _id: "account-i", clientId: "client-a", platform: "instagram", accountName: "Profile A" },
  { _id: "account-other", clientId: "client-b", platform: "linkedin", accountName: "Foreign" },
];
const now = new Date("2026-01-01T00:00:00.000Z");
const context = { client, connections, now };
const exampleRow = [
  "thanksgiving-2026", "Thanksgiving message",
  'Thank you, "everyone"!\nEnjoy the holiday. 🦃',
  "https://example.org/?a=1,b=2", "https://cdn.example.org/photo.jpg",
  "2026-11-26", "10:00", "X", "", "X",
];
const bytes = (rows) => Buffer.from("\ufeff" + stringifyCsvRows(rows), "utf8");

function csvRows() {
  return parseCsvRows(Buffer.from(createBulkCsvTemplate({ client, connections })));
}

test("downloaded CSV template has the exact same account headings and identity row as XLSX", () => {
  const rows = csvRows();
  const workbook = createBulkTemplate({ client, connections });
  const sheet = workbook.getWorksheet("Bulk Posts");
  const columnCount = 7 + bulkAccountColumns(connections, client._id).length;
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], Array.from({ length: columnCount }, (_, index) => sheet.getCell(1, index + 1).value));
  assert.deepEqual(rows[1], Array.from({ length: columnCount }, (_, index) => sheet.getCell(2, index + 1).value || ""));
  assert.equal(rows[1][0], "CONTENT_SOCIAL_HUB_BULK_V1");
  assert.equal(rows[1][1], client._id);
});

test("generated CSV with quoted multiline text and X/blank accounts passes exact existing preview", async () => {
  const rows = csvRows();
  rows.push(exampleRow);
  const parsed = previewBulkCsv(bytes(rows), context);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.posts.length, 1);
  assert.equal(parsed.posts[0].master_text, exampleRow[2]);
  assert.equal(parsed.posts[0].link_url, exampleRow[3]);
  assert.equal(parsed.posts[0].releaseAt, "2026-11-26T16:00:00.000Z");
  assert.deepEqual(parsed.posts[0].destinations.map((item) => item.account.id), ["account-a", "account-i"]);
  assert.equal((await previewBulkFile(bytes(rows), { ...context, filename: "bulk.csv" })).valid, true);
});

test("CSV and XLSX with the same rows produce matching validated posts and destinations", async () => {
  const rows = csvRows();
  rows.push(exampleRow);
  const csv = previewBulkCsv(bytes(rows), context);
  const workbook = createBulkTemplate({ client, connections });
  workbook.getWorksheet("Bulk Posts").addRow(exampleRow);
  const excel = await previewBulkWorkbook(await workbook.xlsx.writeBuffer(), context);
  assert.deepEqual(csv, excel);
});

test("CSV rejects wrong client, swapped or stale account bindings and forged columns", () => {
  const rows = csvRows();
  rows.push(exampleRow);
  const wrongClient = structuredClone(rows);
  wrongClient[1][1] = "client-b";
  assert.throws(() => previewBulkCsv(bytes(wrongClient), context), /selected client/);
  const wrongAccount = structuredClone(rows);
  wrongAccount[1][7] = "account-other";
  assert.throws(() => previewBulkCsv(bytes(wrongAccount), context), /no longer belongs/);
  const forged = structuredClone(rows);
  forged[2].push("X");
  assert.throws(() => previewBulkCsv(bytes(forged), context), /no matching template header/);
  assert.throws(() => previewBulkCsv(bytes(rows), { ...context, connections: connections.filter((account) => account._id !== "account-a") }), /no longer belongs/);
});

test("CSV uses the same duplicate-key, date, media-required and invalid-selection errors", () => {
  const rows = csvRows();
  rows.push(["duplicate", "One", "Text", "", "", "2026-11-26", "10:00", "yes", "", ""]);
  rows.push(["duplicate", "Two", "Text", "", "", "2026-11-27", "10:00", "", "", "X"]);
  const result = previewBulkCsv(bytes(rows), context);
  assert.equal(result.valid, false);
  assert.match(result.posts[0].errors.join(" "), /use X/);
  assert.match(result.posts[1].errors.join(" "), /Duplicate post_key/);
  assert.match(result.posts[1].destinations[0].errors.join(" "), /needs a media URL/);
});

test("optional CSV sample is intentionally incomplete and never silently becomes a publishable row", () => {
  const sample = createBulkCsvTemplate({ client, connections }, { sample: true });
  const result = previewBulkCsv(Buffer.from(sample, "utf8"), context);
  assert.equal(result.valid, false);
  assert.equal(result.posts.length, 1);
  assert.match(result.posts[0].errors.join(" "), /YYYY-MM-DD|text date/);
});
