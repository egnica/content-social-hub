import assert from "node:assert/strict";
import test from "node:test";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import {
  createBulkCsvTemplate, createBulkTemplate, MAX_BULK_FILE_BYTES, previewBulkFile,
} from "../lib/bulk-calendar-preview.js";
import { parseCsvRows, stringifyCsvRows } from "../lib/bulk-csv.js";

const client = { _id: "client-a", name: "Client A", status: "active", timezone: "America/Chicago" };
const accounts = [{ _id: "account-a", clientId: client._id, platform: "facebook", accountName: "Page A" }];

async function api() {
  return loadWithStubs(new URL("../app/api/calendar/bulk-preview/route.js", import.meta.url), {
    apiError: () => Response.json({ error: "Unexpected backend error." }, { status: 500 }),
    createBulkCsvTemplate, createBulkTemplate, MAX_BULK_FILE_BYTES, previewBulkFile,
    listSocialConnections: async () => accounts,
    getClientById: async (id) => id === client._id ? client : null,
    requireApiSession: async () => null,
  });
}

test("GET generates client-bound UTF-8 CSV and distinguishes template from example", async () => {
  const route = await api();
  const base = "https://test.example/api/calendar/bulk-preview?client=client-a&format=csv";
  const response = await route.GET(new Request(base));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/csv/);
  assert.match(response.headers.get("content-disposition"), /calendar-bulk-template\.csv/);
  const rows = parseCsvRows(Buffer.from(await response.arrayBuffer()));
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], "CONTENT_SOCIAL_HUB_BULK_V1");
  assert.equal(rows[1][1], client._id);
  assert.equal(rows[1][7], "account-a");
  const exampleResponse = await route.GET(new Request(base + "&sample=1"));
  assert.match(exampleResponse.headers.get("content-disposition"), /calendar-bulk-example\.csv/);
  assert.equal(parseCsvRows(Buffer.from(await exampleResponse.arrayBuffer())).length, 3);
});

test("POST CSV upload previews a generated, filled client-bound CSV without creating anything", async () => {
  const route = await api();
  const rows = parseCsvRows(Buffer.from(createBulkCsvTemplate({ client, connections: accounts })));
  rows.push(["p1", "First", "Hello from CSV", "", "", "2027-11-26", "10:00", "X"]);
  const csv = stringifyCsvRows(rows);
  const form = new FormData();
  form.set("clientId", client._id);
  form.set("file", new File([csv], "bulk.csv", { type: "text/csv" }));
  const response = await route.POST(new Request("https://test.example/api/calendar/bulk-preview", { method: "POST", body: form }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.preview.valid, true);
  assert.equal(body.preview.posts.length, 1);
  assert.equal(body.preview.posts[0].destinations[0].account.id, "account-a");
});

test("POST fails closed on CSV client mismatch and non-CSV extension", async () => {
  const route = await api();
  const rows = parseCsvRows(Buffer.from(createBulkCsvTemplate({ client, connections: accounts })));
  rows[1][1] = "another-client";
  rows.push(["p1", "One", "Text", "", "", "2027-11-26", "10:00", "X"]);
  const form = new FormData();
  form.set("clientId", client._id);
  form.set("file", new File([stringifyCsvRows(rows)], "bulk.csv", { type: "text/csv" }));
  const response = await route.POST(new Request("https://test.example/api/calendar/bulk-preview", { method: "POST", body: form }));
  assert.equal(response.status, 400);
  const message = await response.json();
  assert.match(message.error, /selected client/);

  const wrong = new FormData();
  wrong.set("clientId", client._id);
  wrong.set("file", new File(["content"], "bulk.txt", { type: "text/plain" }));
  assert.equal((await route.POST(new Request("https://test.example/api/calendar/bulk-preview", { method: "POST", body: wrong }))).status, 400);
});
