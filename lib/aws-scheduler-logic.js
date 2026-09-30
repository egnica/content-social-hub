const AWS_SCHEDULE_PREFIX = "csh";
const AWS_SCHEDULE_NAME_MAX = 64;
const SCHEDULER_MANAGER_ACTIONS = new Set(["create", "update", "delete"]);

function requiredString(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${label} is required.`);
  return normalized;
}

export function normalizeAwsScheduleNamePart(value) {
  return requiredString(value, "Schedule name value")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
}

export function buildAwsScheduleName({ platform, platformVersionId } = {}) {
  const normalizedPlatform = normalizeAwsScheduleNamePart(platform);
  const normalizedVersionId = normalizeAwsScheduleNamePart(platformVersionId);
  const name = `${AWS_SCHEDULE_PREFIX}-${normalizedPlatform}-${normalizedVersionId}`;

  if (name.length > AWS_SCHEDULE_NAME_MAX) {
    throw new TypeError("The generated AWS schedule name exceeds 64 characters.");
  }

  return name;
}

export function buildOneTimeScheduleExpression(releaseAt) {
  const date = releaseAt instanceof Date ? releaseAt : new Date(releaseAt);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("A valid UTC release time is required for AWS scheduling.");
  }

  return `at(${date.toISOString().slice(0, 19)})`;
}

export function buildScheduledReleasePayload(scheduledReleaseId) {
  return JSON.stringify({
    scheduledReleaseId: requiredString(scheduledReleaseId, "Scheduled release ID"),
  });
}

export function buildAwsScheduleDefinition({
  scheduledReleaseId,
  platform,
  platformVersionId,
  releaseAt,
  groupName,
  targetArn,
  targetRoleArn,
  scheduleName,
} = {}) {
  const name = scheduleName || buildAwsScheduleName({ platform, platformVersionId });

  return {
    Name: requiredString(name, "AWS schedule name"),
    GroupName: requiredString(groupName, "Scheduler group name"),
    Description: `Content Social Hub scheduled release ${requiredString(scheduledReleaseId, "Scheduled release ID")}`,
    ScheduleExpression: buildOneTimeScheduleExpression(releaseAt),
    ScheduleExpressionTimezone: "UTC",
    FlexibleTimeWindow: { Mode: "OFF" },
    ActionAfterCompletion: "DELETE",
    State: "ENABLED",
    Target: {
      Arn: requiredString(targetArn, "Scheduled release worker ARN"),
      RoleArn: requiredString(targetRoleArn, "Scheduler target role ARN"),
      Input: buildScheduledReleasePayload(scheduledReleaseId),
      RetryPolicy: {
        MaximumEventAgeInSeconds: 60,
        MaximumRetryAttempts: 0,
      },
    },
  };
}

export function buildSchedulerManagerRequest({
  action,
  schedule,
  scheduleName,
} = {}) {
  const normalizedAction = requiredString(action, "Scheduler manager action").toLowerCase();
  if (!SCHEDULER_MANAGER_ACTIONS.has(normalizedAction)) {
    throw new TypeError("Unsupported Scheduler manager action.");
  }

  if (normalizedAction === "delete") {
    return {
      action: normalizedAction,
      scheduleName: requiredString(scheduleName, "AWS schedule name"),
    };
  }

  const releaseAt =
    schedule?.releaseAt instanceof Date
      ? schedule.releaseAt
      : new Date(schedule?.releaseAt);

  if (Number.isNaN(releaseAt.getTime())) {
    throw new TypeError("A valid UTC release time is required for AWS scheduling.");
  }

  return {
    action: normalizedAction,
    scheduledReleaseId: requiredString(schedule?._id, "Scheduled release ID"),
    platform: requiredString(schedule?.platform, "Schedule platform"),
    platformVersionId: requiredString(
      schedule?.platformVersionId,
      "Platform version ID",
    ),
    releaseAt: releaseAt.toISOString(),
    ...(scheduleName
      ? { scheduleName: requiredString(scheduleName, "AWS schedule name") }
      : {}),
  };
}

export function isMissingSchedulerManagerResource(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || "");
  return (
    name.includes("ResourceNotFoundException") ||
    message.includes("ResourceNotFoundException")
  );
}
