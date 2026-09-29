const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export const ACTIVE_SCHEDULE_STATES = Object.freeze(["scheduled", "dispatching"]);
export const INACTIVE_SCHEDULE_STATES = Object.freeze([
  "cancelled",
  "superseded",
  "missed",
  "succeeded",
  "failed",
]);

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateTimeFormatter(timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function partsInTimeZone(value, timezone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    dateTimeFormatter(timezone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function sameWallClock(left, right) {
  return (
    left?.year === right?.year &&
    left?.month === right?.month &&
    left?.day === right?.day &&
    left?.hour === right?.hour &&
    left?.minute === right?.minute &&
    left?.second === right?.second
  );
}

export function isValidIanaTimeZone(timezone) {
  const normalized = String(timezone || "").trim();
  if (!normalized) return false;

  try {
    dateTimeFormatter(normalized).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function parseLocalDateTime(value) {
  const normalized = String(value || "").trim();
  const match = LOCAL_DATE_TIME_PATTERN.exec(normalized);
  if (!match) return null;

  const parsed = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
  };

  if (
    parsed.month < 1 ||
    parsed.month > 12 ||
    parsed.day < 1 ||
    parsed.day > 31 ||
    parsed.hour < 0 ||
    parsed.hour > 23 ||
    parsed.minute < 0 ||
    parsed.minute > 59 ||
    parsed.second < 0 ||
    parsed.second > 59
  ) {
    return null;
  }

  const check = new Date(
    Date.UTC(
      parsed.year,
      parsed.month - 1,
      parsed.day,
      parsed.hour,
      parsed.minute,
      parsed.second,
    ),
  );

  if (
    check.getUTCFullYear() !== parsed.year ||
    check.getUTCMonth() + 1 !== parsed.month ||
    check.getUTCDate() !== parsed.day ||
    check.getUTCHours() !== parsed.hour ||
    check.getUTCMinutes() !== parsed.minute ||
    check.getUTCSeconds() !== parsed.second
  ) {
    return null;
  }

  return parsed;
}

export function formatUtcDateTimeForZone(value, timezone) {
  if (!value || !isValidIanaTimeZone(timezone)) return "";

  const parts = partsInTimeZone(value, timezone);
  if (!parts) return "";

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function resolveLocalDateTimeToUtc(localDateTime, timezone) {
  const normalizedTimezone = String(timezone || "").trim();
  if (!isValidIanaTimeZone(normalizedTimezone)) {
    return {
      ok: false,
      code: "invalid_timezone",
      error: "The client timezone is invalid. Update the client timezone before scheduling.",
    };
  }

  const wallClock = parseLocalDateTime(localDateTime);
  if (!wallClock) {
    return {
      ok: false,
      code: "invalid_local_time",
      error: "Choose a valid release date and time.",
    };
  }

  const naiveUtc = Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
    wallClock.second,
  );
  const offsets = new Set();

  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const sample = new Date(naiveUtc + hours * 60 * 60 * 1000);
    const sampleParts = partsInTimeZone(sample, normalizedTimezone);
    const sampleUtc = Date.UTC(
      sampleParts.year,
      sampleParts.month - 1,
      sampleParts.day,
      sampleParts.hour,
      sampleParts.minute,
      sampleParts.second,
    );
    offsets.add(sampleUtc - Math.floor(sample.getTime() / 1000) * 1000);
  }

  const matches = [];
  for (const offset of offsets) {
    const candidate = new Date(naiveUtc - offset);
    if (sameWallClock(partsInTimeZone(candidate, normalizedTimezone), wallClock)) {
      matches.push(candidate);
    }
  }

  const uniqueMatches = [
    ...new Map(matches.map((date) => [date.getTime(), date])).values(),
  ].sort((left, right) => left.getTime() - right.getTime());

  if (!uniqueMatches.length) {
    return {
      ok: false,
      code: "nonexistent_local_time",
      error:
        "That local time does not exist in the client timezone because of a daylight-saving transition. Choose another time.",
    };
  }

  if (uniqueMatches.length > 1) {
    return {
      ok: false,
      code: "ambiguous_local_time",
      error:
        "That local time occurs twice in the client timezone because of a daylight-saving transition. Choose another time.",
    };
  }

  const releaseAt = uniqueMatches[0];
  return {
    ok: true,
    code: "resolved",
    releaseAt,
    releaseAtIso: releaseAt.toISOString(),
    timezone: normalizedTimezone,
    localDateTime: `${wallClock.year}-${pad(wallClock.month)}-${pad(wallClock.day)}T${pad(wallClock.hour)}:${pad(wallClock.minute)}`,
  };
}

export function resolveScheduleRelease({
  source = "master",
  masterReleaseAt = null,
  masterReleaseTimezone = "",
  destinationLocalDateTime = "",
  clientTimezone = "",
} = {}) {
  if (!isValidIanaTimeZone(clientTimezone)) {
    return {
      ok: false,
      code: "invalid_timezone",
      error: "The client timezone is invalid. Update the client timezone before scheduling.",
    };
  }

  if (source === "destination_override") {
    const resolved = resolveLocalDateTimeToUtc(
      destinationLocalDateTime,
      clientTimezone,
    );
    return resolved.ok
      ? { ...resolved, source: "destination_override" }
      : resolved;
  }

  if (source !== "master") {
    return {
      ok: false,
      code: "invalid_release_source",
      error: "Choose the Master default or a destination-specific release time.",
    };
  }

  if (!masterReleaseAt) {
    return {
      ok: false,
      code: "no_release_time",
      error: "Add a Master default release time or choose a destination override.",
    };
  }

  const releaseAt = new Date(masterReleaseAt);
  if (Number.isNaN(releaseAt.getTime())) {
    return {
      ok: false,
      code: "invalid_release_time",
      error: "The Master default release time is invalid.",
    };
  }

  const timezone = masterReleaseTimezone || clientTimezone;
  if (!isValidIanaTimeZone(timezone)) {
    return {
      ok: false,
      code: "invalid_timezone",
      error: "The saved release timezone is invalid. Save the Master release time again.",
    };
  }

  return {
    ok: true,
    code: "resolved",
    source: "master",
    releaseAt,
    releaseAtIso: releaseAt.toISOString(),
    timezone,
    localDateTime: formatUtcDateTimeForZone(releaseAt, timezone),
  };
}

function comparableId(value) {
  return String(value || "");
}

function comparableArray(values) {
  return Array.isArray(values) ? values.map(comparableId) : [];
}

export function masterPublishContentChanged(existing = {}, next = {}) {
  const scalarFields = [
    "clientId",
    "text",
    "primaryUrl",
    "contentLength",
    "defaultPrimaryMediaId",
    "defaultVideoThumbnailMediaId",
  ];

  for (const field of scalarFields) {
    if (comparableId(existing[field]) !== comparableId(next[field])) {
      return true;
    }
  }

  const previousMedia = comparableArray(existing.mediaIds);
  const nextMedia = comparableArray(next.mediaIds);
  if (previousMedia.length !== nextMedia.length) return true;

  return previousMedia.some((id, index) => id !== nextMedia[index]);
}

export function isActiveScheduleRecord(schedule) {
  return Boolean(
    schedule?.active === true &&
      ACTIVE_SCHEDULE_STATES.includes(String(schedule?.state || "")),
  );
}

export function isScheduleMutable(schedule) {
  return Boolean(
    schedule?.active === true &&
      String(schedule?.state || "").trim().toLowerCase() === "scheduled" &&
      !schedule?.dispatchedAt,
  );
}

export function findActiveScheduleConflict(
  schedules,
  platformVersionId,
  platformVersionRevision,
) {
  const versionId = comparableId(platformVersionId);
  const revision = Number(platformVersionRevision || 0);

  return (
    (Array.isArray(schedules) ? schedules : []).find(
      (schedule) =>
        isActiveScheduleRecord(schedule) &&
        comparableId(schedule.platformVersionId) === versionId &&
        Number(schedule.platformVersionRevision || 0) === revision,
    ) || null
  );
}

export function evaluateScheduleState({
  releaseAt = null,
  now = new Date(),
  state = "",
  active = false,
  platformVersionRevision = 0,
  currentPlatformVersionRevision = 0,
  publishedRevision = 0,
} = {}) {
  const normalizedState = String(state || "").trim().toLowerCase();

  if (normalizedState === "cancelled") {
    return { code: "cancelled", valid: false };
  }

  if (normalizedState === "superseded") {
    return { code: "superseded", valid: false };
  }

  if (!releaseAt) {
    return { code: "no_release_time", valid: false };
  }

  const releaseDate = new Date(releaseAt);
  if (Number.isNaN(releaseDate.getTime())) {
    return { code: "invalid_release_time", valid: false };
  }

  const scheduledRevision = Number(platformVersionRevision || 0);
  const currentRevision = Number(currentPlatformVersionRevision || 0);
  const successfulRevision = Number(publishedRevision || 0);

  if (
    scheduledRevision > 0 &&
    currentRevision > 0 &&
    scheduledRevision !== currentRevision
  ) {
    return { code: "stale_content_revision", valid: false };
  }

  if (scheduledRevision > 0 && successfulRevision === scheduledRevision) {
    return { code: "already_published_revision", valid: false };
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime()) || releaseDate.getTime() <= nowDate.getTime()) {
    return { code: "past_release_time", valid: false };
  }

  if (active && ACTIVE_SCHEDULE_STATES.includes(normalizedState)) {
    return { code: "active_schedule", valid: true };
  }

  return { code: "ready", valid: true };
}
