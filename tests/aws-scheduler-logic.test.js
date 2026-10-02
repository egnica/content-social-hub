import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAwsScheduleDefinition,
  buildAwsScheduleName,
  buildOneTimeScheduleExpression,
  buildScheduledReleasePayload,
  buildSchedulerManagerRequest,
  isMissingSchedulerManagerResource,
} from "../lib/aws-scheduler-logic.js";

test("AWS schedule names are stable and destination-specific", () => {
  assert.equal(
    buildAwsScheduleName({
      platform: "facebook",
      platformVersionId: "66F00A1234567890ABCDEF12",
    }),
    "csh-facebook-66f00a1234567890abcdef12",
  );
});

test("Instagram AWS schedule names use a separate provider namespace", () => {
  assert.equal(
    buildAwsScheduleName({
      platform: "instagram",
      platformVersionId: "66F00A1234567890ABCDEF12",
    }),
    "csh-instagram-66f00a1234567890abcdef12",
  );
});

test("AWS one-time expression uses the resolved UTC instant", () => {
  assert.equal(
    buildOneTimeScheduleExpression("2026-09-30T13:30:00.000Z"),
    "at(2026-09-30T13:30:00)",
  );
});

test("Lambda payload identifies only the scheduled-release record", () => {
  assert.deepEqual(
    JSON.parse(buildScheduledReleasePayload("66f00a1234567890abcdef99")),
    {
      scheduledReleaseId: "66f00a1234567890abcdef99",
    },
  );
});

test("one-time AWS schedule definition is exact, non-flexible, and non-retrying", () => {
  const definition = buildAwsScheduleDefinition({
    scheduledReleaseId: "66f00a1234567890abcdef99",
    platform: "facebook",
    platformVersionId: "66f00a1234567890abcdef12",
    releaseAt: "2026-09-30T13:30:00.000Z",
    groupName: "content-social-hub",
    targetArn: "arn:aws:lambda:us-east-2:123456789012:function:worker",
    targetRoleArn: "arn:aws:iam::123456789012:role/scheduler-target",
  });

  assert.equal(definition.Name, "csh-facebook-66f00a1234567890abcdef12");
  assert.equal(definition.ScheduleExpression, "at(2026-09-30T13:30:00)");
  assert.equal(definition.ScheduleExpressionTimezone, "UTC");
  assert.deepEqual(definition.FlexibleTimeWindow, { Mode: "OFF" });
  assert.equal(definition.ActionAfterCompletion, "DELETE");
  assert.deepEqual(definition.Target.RetryPolicy, {
    MaximumEventAgeInSeconds: 60,
    MaximumRetryAttempts: 0,
  });
  assert.deepEqual(JSON.parse(definition.Target.Input), {
    scheduledReleaseId: "66f00a1234567890abcdef99",
  });
});

test("scheduler manager create request carries only scheduling identifiers and release time", () => {
  const request = buildSchedulerManagerRequest({
    action: "create",
    schedule: {
      _id: "66f00a1234567890abcdef99",
      platform: "facebook",
      platformVersionId: "66f00a1234567890abcdef12",
      releaseAt: new Date("2026-09-30T13:30:00.000Z"),
      oauthToken: "must-not-leak",
      targetRoleArn: "must-not-leak",
    },
  });

  assert.deepEqual(request, {
    action: "create",
    scheduledReleaseId: "66f00a1234567890abcdef99",
    platform: "facebook",
    platformVersionId: "66f00a1234567890abcdef12",
    releaseAt: "2026-09-30T13:30:00.000Z",
  });
});

test("scheduler manager request preserves Instagram platform identity", () => {
  const request = buildSchedulerManagerRequest({
    action: "create",
    schedule: {
      _id: "66f00a1234567890abcdef99",
      platform: "instagram",
      platformVersionId: "66f00a1234567890abcdef12",
      releaseAt: new Date("2026-10-02T03:30:00.000Z"),
    },
  });

  assert.equal(request.platform, "instagram");
  assert.equal(request.platformVersionId, "66f00a1234567890abcdef12");
});

test("scheduler manager delete request contains only the stable AWS schedule name", () => {
  assert.deepEqual(
    buildSchedulerManagerRequest({
      action: "delete",
      scheduleName: "csh-facebook-66f00a1234567890abcdef12",
    }),
    {
      action: "delete",
      scheduleName: "csh-facebook-66f00a1234567890abcdef12",
    },
  );
});

test("missing one-time AWS schedules are recognized for safe reschedule recreation", () => {
  assert.equal(
    isMissingSchedulerManagerResource({
      name: "ResourceNotFoundException",
      message: "schedule does not exist",
    }),
    true,
  );
  assert.equal(
    isMissingSchedulerManagerResource({
      name: "SchedulerManagerError",
      message:
        "ResourceNotFoundException: Schedule csh-facebook-66f00a1234567890abcdef12 does not exist.",
    }),
    true,
  );
  assert.equal(
    isMissingSchedulerManagerResource({
      name: "AccessDeniedException",
      message: "not authorized",
    }),
    false,
  );
});
