import test from "node:test";
import assert from "node:assert/strict";
import { classifyBulkSchedule, reviewKey } from "../lib/bulk-schedule-logic.js";
import { loadWithStubs } from "./helpers/load-with-stubs.js";

const releaseAt = "2027-01-12T20:00:00.000Z";
const timezone = "America/Chicago";
const now = new Date("2026-11-25T20:00:00Z");
const state = { platformVersionRevision: 1, currentRevisionPublished: false, clientTimezone: timezone,
  masterDefault: { available: true, releaseAt }, canSchedule: true, validation: { blocking: [] } };
test("bulk eligibility uses exact future release, current authorization and destination validation", () => {
  assert.equal(classifyBulkSchedule(state, releaseAt, timezone, now).status, "ready");
  for (const change of [
    { clientTimezone: "UTC" }, { masterDefault: { available: true, releaseAt: "2027-01-13T20:00:00Z" } },
    { canSchedule: false }, { currentRevisionPublished: true }, { tokenExpiresAt: "2027-01-01T00:00:00Z" },
    { schedule: { state: "failed" } },
  ]) assert.equal(classifyBulkSchedule({ ...state, ...change }, releaseAt, timezone, now).status, "blocked");
  assert.equal(classifyBulkSchedule(state, releaseAt, timezone, new Date(releaseAt)).status, "blocked");
});
test("only matching linked schedule is recognized as existing; conflicts and incomplete AWS links block", () => {
  const schedule = { _id: "s", state: "scheduled", awsScheduleId: "aws", platformVersionRevision: 1, releaseAt, timezone };
  const active = { ...state, activeScheduleId: "s", schedule };
  assert.equal(classifyBulkSchedule(active, releaseAt, timezone, now).status, "existing");
  for (const change of [{ awsScheduleId: null }, { platformVersionRevision: 2 }, { releaseAt: "2027-01-13T20:00:00Z" }, { state: "dispatching" }]) {
    assert.equal(classifyBulkSchedule({ ...active, schedule: { ...schedule, ...change } }, releaseAt, timezone, now).status, "blocked");
  }
});
test("review keys bind client, exact account, time and revisions", () => {
  const fields = { clientId: "c", masterId: "m", masterRevision: 1, versionId: "v", versionRevision: 1,
    accountId: "a", releaseAt, fingerprint: "f" };
  for (const key of Object.keys(fields)) assert.notEqual(reviewKey(fields), reviewKey({ ...fields, [key]: "changed" }));
});
test("bulk review makes no schedules; execution skips unreviewed destinations and returns per-account results", async () => {
  const client = { _id: "c", timezone };
  const account = { id: "a", platform: "facebook", name: "Page" };
  const post = { row: 3, post_key: "key", title: "Test", releaseAt, destinations: [{ account }] };
  const master = { _id: "m", clientId: "c", revision: 1, bulkImport: { fingerprint: "f" } };
  const version = { _id: "v", clientId: "c", masterContentId: "m", socialConnectionId: "a", platform: "facebook", revision: 1 };
  let writes = 0;
  const server = await loadWithStubs(new URL("../lib/bulk-schedule.js", import.meta.url), {
    getImportedBulkContent: async () => master, bulkDraftFingerprint: () => "f", validateBulkDraftAccounts: () => ["a"],
    getPlatformDestinationState: async () => ({ platformVersions: [version] }),
    getDestinationScheduleState: async () => state, classifyBulkSchedule: (s, r, t) => classifyBulkSchedule(s, r, t, now),
    reviewKey, createDestinationScheduleWithInfrastructure: async input => {
      writes++; assert.equal(input.expectedBulk.accountId, "a"); assert.equal(input.expectedBulk.releaseAt, releaseAt);
      return { _id: "schedule" };
    },
  });
  const review = await server.reviewBulkScheduleRow(post, client, []);
  assert.equal(review.destinations[0].status, "ready"); assert.equal(writes, 0);
  assert.equal((await server.scheduleBulkRow(post, client, [], new Set())).destinations[0].status, "skipped");
  assert.equal(writes, 0);
  const keys = new Set([review.destinations[0].key]);
  assert.equal((await server.scheduleBulkRow(post, client, [], keys)).destinations[0].status, "scheduled");
  assert.equal(writes, 1);
  version.revision = 2;
  assert.equal((await server.scheduleBulkRow(post, client, [], keys)).destinations[0].status, "skipped");
  assert.equal(writes, 1);
});
