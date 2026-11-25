import { createHash } from "node:crypto";

export const BULK_SCHEDULE_BATCH_SIZE = 5;

export function reviewKey({ clientId, masterId, masterRevision, versionId, versionRevision, accountId, releaseAt, fingerprint }) {
  return createHash("sha256").update(JSON.stringify([clientId, masterId, masterRevision, versionId, versionRevision, accountId, releaseAt, fingerprint])).digest("hex");
}

export function classifyBulkSchedule(state, releaseAt, timezone, now = new Date()) {
  const sameRelease = Date.parse(state.schedule?.releaseAt) === Date.parse(releaseAt);
  if (state.currentRevisionPublished) return { status: "blocked", error: "This revision is already published." };
  if (state.activeScheduleId) {
    if (state.schedule?.state === "scheduled" && state.schedule?.awsScheduleId &&
        Number(state.schedule.platformVersionRevision) === state.platformVersionRevision &&
        sameRelease && state.schedule.timezone === timezone && !state.stale) {
      return { status: "existing", scheduleId: state.schedule._id };
    }
    return { status: "blocked", error: "An active or incomplete schedule already exists. Review it in Content; bulk scheduling will not replace it." };
  }
  if (state.schedule && !["cancelled", "superseded"].includes(state.schedule.state)) {
    return { status: "blocked", error: "A prior release requires individual review in Content." };
  }
  if (state.clientTimezone !== timezone || !state.masterDefault?.available ||
      Date.parse(state.masterDefault.releaseAt) !== Date.parse(releaseAt)) {
    return { status: "blocked", error: "The saved release time or client timezone changed. Review the draft in Content." };
  }
  if (!Number.isFinite(Date.parse(releaseAt)) || Date.parse(releaseAt) <= now.getTime()) {
    return { status: "blocked", error: "The release time must be in the future." };
  }
  if (!state.canSchedule) return { status: "blocked", error: state.validation?.blocking?.join(" ") || "This destination is not eligible." };
  if (state.tokenExpiresAt && Date.parse(state.tokenExpiresAt) <= Date.parse(releaseAt)) {
    return { status: "blocked", error: "LinkedIn authorization expires before this release. Reconnect closer to the date." };
  }
  return { status: "ready" };
}
