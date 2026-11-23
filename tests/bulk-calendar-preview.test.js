import assert from "node:assert/strict";
import test from "node:test";
import { bulkAccountColumns, createBulkTemplate, previewBulkWorkbook } from "../lib/bulk-calendar-preview.js";

const client = { _id: "client-a", name: "Client A", status: "active", timezone: "America/Chicago" };
const connections = [
  { _id: "account-a", clientId: "client-a", platform: "facebook", accountName: "Page A" },
  { _id: "account-g", clientId: "client-a", platform: "google_business_profile", accountName: "Location A" },
  { _id: "account-i", clientId: "client-a", platform: "instagram", accountName: "Profile A" },
  { _id: "account-b", clientId: "client-b", platform: "facebook", accountName: "Page B" },
];
const now = new Date("2026-01-01T00:00:00Z");
const accountColumns = bulkAccountColumns(connections, client._id);

async function preview(rows, mutate = () => {}) {
  const workbook = createBulkTemplate({ client, connections });
  const sheet = workbook.getWorksheet("Bulk Posts");
  for (const row of rows) sheet.addRow(row);
  mutate(sheet);
  return previewBulkWorkbook(await workbook.xlsx.writeBuffer(), { client, connections, now });
}

test("one-sheet template uses hidden exact IDs; X includes and blank skips an account", async () => {
  const workbook = createBulkTemplate({ client, connections });
  assert.equal(workbook.worksheets.length, 1);
  assert.equal(workbook.getWorksheet("Bulk Posts").getRow(2).hidden, true);
  assert.equal(accountColumns.length, 3);
  const result = await preview([
    ["week-one", "Opening", "Hello\nworld", "https://example.com/", "", "2026-01-15", "10:30", "X", "X", ""],
    ["week-two", "Second", "Another post", "", "https://example.com/photo.jpg", "2026-01-17", "11:00", "", "X", "X"],
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.posts[0].destinations.length, 2);
  assert.equal(result.posts[0].destinations[0].account.id, "account-a");
  assert.equal(result.posts[0].destinations[0].mediaChoice, "Link preview (appearance may differ on the platform)");
  assert.match(result.posts[0].destinations[1].mediaChoice, /metadata image fallback/);
  assert.equal(result.posts[0].releaseAt, "2026-01-15T16:30:00.000Z");
  assert.equal(result.posts[1].releaseAt, "2026-01-17T17:00:00.000Z");
});

test("foreign account and wrong selected client cannot be substituted in the hidden template identity", async () => {
  const row = ["one", "One", "Text", "", "", "2026-01-15", "10:30", "X"];
  await assert.rejects(preview([row], (sheet) => { sheet.getCell(2, 2).value = "client-b"; }), /selected client/);
  await assert.rejects(preview([row], (sheet) => { sheet.getCell(2, 8).value = "account-b"; }), /no longer belongs/);
  await assert.rejects(preview([row], (sheet) => { sheet.getCell(3, 11).value = "X"; }), /no matching template header/);
});

test("duplicate post keys, invalid X, unsafe URL and unselected rows are reported", async () => {
  const result = await preview([
    ["p1", "First", "Text", "javascript:alert(1)", "", "2026-01-15", "10:30", "yes"],
    ["p1", "Second", "Text", "", "", "2026-01-16", "11:00", ""],
  ]);
  assert.equal(result.valid, false);
  assert.match(result.posts[0].errors.join(" "), /link_url/);
  assert.match(result.posts[0].errors.join(" "), /use X/);
  assert.match(result.posts[1].errors.join(" "), /Duplicate post_key/);
  assert.match(result.posts[1].errors.join(" "), /at least one social account/);
});

test("DST ambiguity, Excel date and formula cells are rejected without shifting the schedule", async () => {
  const result = await preview([
    ["p1", "First", { formula: "1+1", result: 2 }, "", "", "2026-11-01", "01:30", "X"],
    ["p2", "Second", "Text", "", "", new Date("2026-11-01T00:00:00Z"), "01:30", "X"],
  ]);
  assert.equal(result.valid, false);
  assert.match(result.posts[0].errors.join(" "), /plain text/);
  assert.match(result.posts[0].errors.join(" "), /twice/);
  assert.match(result.posts[1].errors.join(" "), /plain text/);
});

test("Instagram selection requires media instead of treating a link as an image", async () => {
  const result = await preview([["p1", "First", "Text", "https://example.com/", "", "2026-01-15", "10:30", "", "", "X"]]);
  assert.equal(result.valid, false);
  assert.match(result.posts[0].destinations[0].errors.join(" "), /needs a media URL/);
});
