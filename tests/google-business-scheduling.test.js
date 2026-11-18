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
import { validateGoogleBusinessPublish } from "../lib/google-business-publish-logic.js";
import { googleBusinessParent } from "../lib/google-business-post-logic.js";

const id = letter => letter.repeat(24);
const parent = "accounts/123/locations/456";

async function fixture({ image = false, providerAccountId = "locations/456",
  parentIdentity = parent, canManageLocation = true, versionChange = {},
  assetChange = {} } = {}) {
  const client = { _id: id("c"), timezone: "America/Chicago" };
  const master = {
    _id: id("m"), clientId: client._id, revision: 3,
    defaultReleaseAt: new Date(Date.now() + 86400000),
    defaultReleaseTimezone: client.timezone,
    mediaIds: image ? [id("f")] : [],
  };
  const version = {
    _id: id("v"), platform: "google_business_profile", active: true,
    clientId: client._id, masterContentId: master._id, socialConnectionId: id("s"),
    providerAccountId: "locations/456", googleBusinessParent: parent,
    revision: 2, publishedRevision: 0, masterRevisionSynced: 3,
    summary: "A scheduled Google Business update", ctaType: "LEARN_MORE",
    ctaUrl: "https://example.org", mediaIds: image ? [id("f")] : [],
    ...versionChange,
  };
  const connection = {
    _id: id("s"), clientId: client._id, platform: "google_business_profile",
    providerAccountId, providerParent: parentIdentity,
    accountResourceName: "accounts/123", locationResourceName: "locations/456",
    healthStatus: "healthy", capabilities: { canManageLocation, canPublish: false },
  };
  const schedules = fakeCollection([]);
  schedules.insertOne = async doc => {
    const insertedId = id(String(schedules.documents.length + 1));
    schedules.documents.push({ ...doc, _id: insertedId });
    return { insertedId };
  };
  const assets = image ? [{
    _id: id("f"), clientId: client._id, status: "uploaded",
    contentType: "image/png", size: 18000, width: 720, height: 720,
    originalName: "photo.png", ...assetChange,
  }] : [];
  const collections = {
    clients: fakeCollection([client]),
    social_connections: fakeCollection([connection]),
    master_content: fakeCollection([master]),
    media_assets: fakeCollection(assets),
    platform_versions: fakeCollection([version]),
    scheduled_releases: schedules,
  };
  const server = await loadWithStubs(new URL("../lib/scheduling.js", import.meta.url), {
    getDb: async () => ({ collection: name => collections[name] }),
    toObjectId: value => value,
    serializeDocument: value => structuredClone(value),
    evaluateScheduleState, formatUtcDateTimeForZone, isScheduleMutable,
    resolveScheduleRelease, validateGoogleBusinessPublish, googleBusinessParent,
  });
  return { server, version, master, connection, schedules, assets };
}

test("Google schedule stores exact client/location/parent, UTC release and revision without requiring canPublish", async () => {
  const f = await fixture({ image: true });
  const state = await f.server.getDestinationScheduleState(f.version._id);
  assert.equal(state.canSchedule, true);
  const record = await f.server.createDestinationSchedule({ platformVersionId: f.version._id });
  assert.equal(record.platform, "google_business_profile");
  assert.equal(record.platformVersionRevision, 2);
  assert.equal(record.providerAccountId, "locations/456");
  assert.equal(record.googleBusinessParent, parent);
  assert.equal(record.timezone, "America/Chicago");
  assert.equal(record.active, true);
  assert.equal(f.schedules.documents.length, 1);
  await assert.rejects(
    f.server.createDestinationSchedule({ platformVersionId: f.version._id }),
    /active schedule/,
  );
});

test("Google wrong client, changed parent and inaccessible locations cannot be scheduled", async () => {
  const cases = [
    { providerAccountId: "locations/999" },
    { parentIdentity: "accounts/999/locations/456" },
    { canManageLocation: false },
    { versionChange: { clientId: id("d") } },
    { versionChange: { googleBusinessParent: "accounts/123/locations/999" } },
    { versionChange: { googlePublishLock: true } },
    { versionChange: { publishedRevision: 2 } },
    { versionChange: { masterRevisionSynced: 2 } },
  ];
  for (const change of cases) {
    const f = await fixture(change);
    await assert.rejects(f.server.createDestinationSchedule({ platformVersionId: f.version._id }));
    assert.equal(f.schedules.documents.length, 0);
  }
});

test("Google schedules refuse foreign, missing and incompatible media", async () => {
  for (const options of [
    { assetChange: { clientId: id("z") } },
    { assetChange: { contentType: "video/mp4" } },
    { assetChange: { size: 500 } },
    { versionChange: { mediaIds: [id("g")] } },
  ]) {
    const f = await fixture({ image: true, ...options });
    await assert.rejects(f.server.createDestinationSchedule({ platformVersionId: f.version._id }));
    assert.equal(f.schedules.documents.length, 0);
  }
  const detached = await fixture({ image: true });
  detached.master.mediaIds = [];
  await assert.rejects(detached.server.createDestinationSchedule({ platformVersionId: detached.version._id }));
});

test("Google reschedule and pre-dispatch cancellation retain the existing safe transitions", async () => {
  const f = await fixture();
  const first = await f.server.createDestinationSchedule({ platformVersionId: f.version._id });
  const second = await f.server.rescheduleDestinationSchedule({
    platformVersionId: f.version._id, scheduleId: first._id,
    releaseSource: "destination_override", destinationLocalDateTime:
      formatUtcDateTimeForZone(new Date(Date.now() + 3 * 86400000), "America/Chicago"),
  });
  assert.equal(first.platformVersionRevision, second.platformVersionRevision);
  assert.equal(f.schedules.documents[0].state, "superseded");
  const cancelled = await f.server.cancelDestinationSchedule({
    platformVersionId: f.version._id, scheduleId: second._id,
  });
  assert.equal(cancelled.state, "cancelled");
  assert.equal(cancelled.active, false);
});
