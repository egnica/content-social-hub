import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateScheduleState,
  findActiveScheduleConflict,
  formatUtcDateTimeForZone,
  isScheduleMutable,
  isValidIanaTimeZone,
  masterPublishContentChanged,
  resolveLocalDateTimeToUtc,
  resolveScheduleRelease,
} from "../lib/scheduling-logic.js";

test("validates IANA timezone names without browser fallback", () => {
  assert.equal(isValidIanaTimeZone("America/Chicago"), true);
  assert.equal(isValidIanaTimeZone("Not/A_Timezone"), false);
});

test("resolves winter and summer Chicago wall times with DST-aware offsets", () => {
  const winter = resolveLocalDateTimeToUtc("2026-01-15T10:00", "America/Chicago");
  const summer = resolveLocalDateTimeToUtc("2026-07-15T10:00", "America/Chicago");

  assert.equal(winter.ok, true);
  assert.equal(winter.releaseAtIso, "2026-01-15T16:00:00.000Z");
  assert.equal(summer.ok, true);
  assert.equal(summer.releaseAtIso, "2026-07-15T15:00:00.000Z");
});

test("blocks nonexistent and ambiguous daylight-saving wall times", () => {
  const missing = resolveLocalDateTimeToUtc("2026-03-08T02:30", "America/Chicago");
  const repeated = resolveLocalDateTimeToUtc("2026-11-01T01:30", "America/Chicago");

  assert.equal(missing.ok, false);
  assert.equal(missing.code, "nonexistent_local_time");
  assert.equal(repeated.ok, false);
  assert.equal(repeated.code, "ambiguous_local_time");
});

test("formats stored UTC release instants back into the client timezone", () => {
  assert.equal(
    formatUtcDateTimeForZone("2026-07-15T15:00:00.000Z", "America/Chicago"),
    "2026-07-15T10:00",
  );
});

test("resolves Master default and destination override without changing publish fields", () => {
  const master = resolveScheduleRelease({
    source: "master",
    masterReleaseAt: "2026-01-15T16:00:00.000Z",
    masterReleaseTimezone: "America/Chicago",
    clientTimezone: "America/Chicago",
  });
  const override = resolveScheduleRelease({
    source: "destination_override",
    destinationLocalDateTime: "2026-01-15T11:30",
    clientTimezone: "America/Chicago",
  });

  assert.equal(master.ok, true);
  assert.equal(master.localDateTime, "2026-01-15T10:00");
  assert.equal(master.source, "master");
  assert.equal(override.ok, true);
  assert.equal(override.releaseAtIso, "2026-01-15T17:30:00.000Z");
  assert.equal(override.source, "destination_override");
});

test("schedule-only Master changes do not count as publish-content revisions", () => {
  const current = {
    clientId: "client-1",
    text: "Copy",
    primaryUrl: "https://example.com",
    contentLength: "short",
    mediaIds: ["media-1", "media-2"],
    defaultPrimaryMediaId: "media-1",
    defaultVideoThumbnailMediaId: "thumb-1",
    defaultReleaseAt: "2026-01-15T16:00:00.000Z",
    defaultReleaseTimezone: "America/Chicago",
  };

  assert.equal(
    masterPublishContentChanged(current, {
      ...current,
      defaultReleaseAt: "2026-01-16T16:00:00.000Z",
    }),
    false,
  );
  assert.equal(
    masterPublishContentChanged(current, { ...current, text: "Changed copy" }),
    true,
  );
  assert.equal(
    masterPublishContentChanged(current, {
      ...current,
      mediaIds: ["media-2", "media-1"],
    }),
    true,
  );
});

test("schedule state validation covers missing, past, active, cancelled, superseded, stale, and published revisions", () => {
  const future = "2026-10-10T18:00:00.000Z";
  const now = new Date("2026-09-29T21:00:00.000Z");

  assert.equal(evaluateScheduleState({ now }).code, "no_release_time");
  assert.equal(
    evaluateScheduleState({ releaseAt: "2026-09-01T12:00:00.000Z", now }).code,
    "past_release_time",
  );
  assert.equal(
    evaluateScheduleState({ releaseAt: future, now, state: "scheduled", active: true }).code,
    "active_schedule",
  );
  assert.equal(
    evaluateScheduleState({ releaseAt: future, now, state: "cancelled" }).code,
    "cancelled",
  );
  assert.equal(
    evaluateScheduleState({ releaseAt: future, now, state: "superseded" }).code,
    "superseded",
  );
  assert.equal(
    evaluateScheduleState({
      releaseAt: future,
      now,
      state: "scheduled",
      active: true,
      platformVersionRevision: 2,
      currentPlatformVersionRevision: 3,
    }).code,
    "stale_content_revision",
  );
  assert.equal(
    evaluateScheduleState({
      releaseAt: future,
      now,
      platformVersionRevision: 3,
      currentPlatformVersionRevision: 3,
      publishedRevision: 3,
    }).code,
    "already_published_revision",
  );
});

test("duplicate active schedule helper finds conflicts only for the same destination revision", () => {
  const schedules = [
    {
      platformVersionId: "version-1",
      platformVersionRevision: 4,
      state: "scheduled",
      active: true,
    },
    {
      platformVersionId: "version-1",
      platformVersionRevision: 3,
      state: "superseded",
      active: false,
    },
  ];

  assert.ok(findActiveScheduleConflict(schedules, "version-1", 4));
  assert.equal(findActiveScheduleConflict(schedules, "version-1", 3), null);
  assert.equal(findActiveScheduleConflict(schedules, "version-2", 4), null);
});

test("only an active scheduled release can be rescheduled or cancelled before dispatch", () => {
  assert.equal(
    isScheduleMutable({ state: "scheduled", active: true, dispatchedAt: null }),
    true,
  );
  assert.equal(
    isScheduleMutable({ state: "dispatching", active: true, dispatchedAt: null }),
    false,
  );
  assert.equal(
    isScheduleMutable({
      state: "scheduled",
      active: true,
      dispatchedAt: "2026-10-10T18:00:00.000Z",
    }),
    false,
  );
  assert.equal(
    isScheduleMutable({ state: "cancelled", active: false, dispatchedAt: null }),
    false,
  );
});
