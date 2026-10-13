import assert from "node:assert/strict";
import test from "node:test";
import { fakeCollection } from "./helpers/fake-mongo.js";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import {
  evaluateScheduleState,
  formatUtcDateTimeForZone,
  isScheduleMutable,
  resolveScheduleRelease,
} from "../lib/scheduling-logic.js";
import { validateLinkedInScheduledPublishDraft } from "../lib/linkedin-publish-logic.js";

const id = (letter) => letter.repeat(24);

async function setup({
  providerAccountId = "person-a",
  tokenExpiresAt = new Date(Date.now() + 45 * 86400000),
  releaseAt = new Date(Date.now() + 86400000),
} = {}) {
  const client = {
    _id: id("c"), timezone: "America/Chicago",
  };
  const master = {
    _id: id("m"), clientId: client._id, revision: 3,
    defaultReleaseAt: releaseAt,
    defaultReleaseTimezone: client.timezone,
  };
  const version = {
    _id: id("v"), clientId: client._id, masterContentId: master._id,
    socialConnectionId: id("s"), providerAccountId: "person-a",
    platform: "linkedin", active: true,
    message: "An actual LinkedIn update", mediaIds: [],
    revision: 2, publishedRevision: 0, masterRevisionSynced: 3,
  };
  const connection = {
    _id: id("s"), clientId: client._id, platform: "linkedin",
    providerAccountId, healthStatus: "healthy",
    capabilities: { canPublish: true }, tokenExpiresAt,
  };
  const schedules = fakeCollection([]);
  schedules.insertOne = async (document) => {
    const insertedId = id(String(schedules.documents.length + 1));
    schedules.documents.push({ ...document, _id: insertedId });
    return { insertedId };
  };
  const collections = {
    clients: fakeCollection([client]),
    social_connections: fakeCollection([connection]),
    master_content: fakeCollection([master]),
    media_assets: fakeCollection([]),
    platform_versions: fakeCollection([version]),
    scheduled_releases: schedules,
  };
  const server = await loadWithStubs(
    new URL("../lib/scheduling.js", import.meta.url),
    {
      getDb: async () => ({ collection: (name) => collections[name] }),
      toObjectId: (value) => value,
      serializeDocument: (value) => structuredClone(value),
      evaluateScheduleState,
      formatUtcDateTimeForZone,
      isScheduleMutable,
      resolveScheduleRelease,
      validateLinkedInScheduledPublishDraft,
    },
  );
  return { server, client, master, version, connection, schedules };
}

test("client-scoped LinkedIn release binds immutable revision, UTC time and member", async () => {
  const f = await setup();
  const created = await f.server.createDestinationSchedule({
    platformVersionId: f.version._id,
  });
  assert.equal(created.platform, "linkedin");
  assert.equal(created.providerAccountId, "person-a");
  assert.equal(created.platformVersionRevision, 2);
  assert.equal(created.timezone, "America/Chicago");
  assert.equal(created.state, "scheduled");
  assert.equal(created.active, true);
  assert.equal(f.schedules.documents.length, 1);
  await assert.rejects(
    f.server.createDestinationSchedule({ platformVersionId: f.version._id }),
    /already has an active schedule/,
  );
});

test("LinkedIn refuses to schedule beyond the verified authorization expiry", async () => {
  const f = await setup({
    tokenExpiresAt: new Date(Date.now() + 86400000),
    releaseAt: new Date(Date.now() + 3 * 86400000),
  });
  await assert.rejects(
    f.server.createDestinationSchedule({ platformVersionId: f.version._id }),
    /authorization will expire/,
  );
  assert.equal(f.schedules.documents.length, 0);
});

test("LinkedIn account changes cannot borrow an existing client's destination", async () => {
  const f = await setup({ providerAccountId: "person-b" });
  await assert.rejects(
    f.server.createDestinationSchedule({ platformVersionId: f.version._id }),
    /no longer connected/,
  );
});

test("LinkedIn reschedule and pre-dispatch cancellation preserve safe state transitions", async () => {
  const f = await setup();
  const first = await f.server.createDestinationSchedule({
    platformVersionId: f.version._id,
  });
  const second = await f.server.rescheduleDestinationSchedule({
    platformVersionId: f.version._id,
    scheduleId: first._id,
    releaseSource: "master",
  });
  assert.equal(second.state, "scheduled");
  assert.equal(f.schedules.documents.length, 2);
  assert.equal(f.schedules.documents[0].state, "superseded");
  const cancelled = await f.server.cancelDestinationSchedule({
    platformVersionId: f.version._id,
    scheduleId: second._id,
  });
  assert.equal(cancelled.state, "cancelled");
  assert.equal(cancelled.active, false);
  assert.equal(f.schedules.documents[1].active, false);
});
