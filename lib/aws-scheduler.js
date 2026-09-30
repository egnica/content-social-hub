import "server-only";

import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@smithy/signature-v4";
import { createHash, createHmac } from "node:crypto";
import { getAwsRegion, requireEnv } from "@/lib/env";
import {
  buildAwsScheduleName,
  buildSchedulerManagerRequest,
  isMissingSchedulerManagerResource,
} from "@/lib/aws-scheduler-logic";

class NodeSha256 {
  constructor(secret) {
    this.hash = secret
      ? createHmac("sha256", Buffer.from(secret))
      : createHash("sha256");
  }

  update(data) {
    this.hash.update(data);
  }

  async digest() {
    return Uint8Array.from(this.hash.digest());
  }
}

const region = getAwsRegion();
const hostname = `lambda.${region}.amazonaws.com`;
const credentials = defaultProvider();
const signer = new SignatureV4({
  credentials,
  region,
  service: "lambda",
  sha256: NodeSha256,
});

function managerFunctionName() {
  return requireEnv("SCHEDULER_MANAGER_FUNCTION_NAME");
}

function invokePath(functionName) {
  return `/2015-03-31/functions/${encodeURIComponent(functionName)}/invocations`;
}

async function invokeSchedulerManager(payload) {
  const functionName = managerFunctionName();
  const path = invokePath(functionName);
  const body = JSON.stringify(payload);
  const request = {
    protocol: "https:",
    hostname,
    method: "POST",
    path,
    headers: {
      host: hostname,
      "content-type": "application/json",
    },
    body,
  };
  const signed = await signer.sign(request);
  const response = await fetch(`https://${hostname}${path}`, {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
    cache: "no-store",
  });
  const text = await response.text();
  let result = null;

  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      result = { message: text };
    }
  }

  const functionError = response.headers.get("x-amz-function-error");
  if (!response.ok || functionError || result?.errorMessage) {
    const error = new Error(
      result?.errorMessage ||
        result?.message ||
        `Scheduler manager invocation failed (${response.status}).`,
    );
    error.name = String(result?.errorType || functionError || "SchedulerManagerError");
    error.statusCode = response.status;
    throw error;
  }

  return result || {};
}

export async function createAwsScheduleForRelease(schedule) {
  const name = buildAwsScheduleName({
    platform: schedule?.platform,
    platformVersionId: schedule?.platformVersionId,
  });
  const result = await invokeSchedulerManager(
    buildSchedulerManagerRequest({
      action: "create",
      schedule,
    }),
  );

  return {
    name: result.name || name,
    arn: result.arn || null,
  };
}

export async function updateAwsScheduleForRelease(schedule, scheduleName) {
  let result;

  try {
    result = await invokeSchedulerManager(
      buildSchedulerManagerRequest({
        action: "update",
        schedule,
        scheduleName,
      }),
    );
  } catch (error) {
    if (!isMissingSchedulerManagerResource(error)) throw error;

    // One-time schedules auto-delete after firing. If MongoDB still has the
    // release history, Reschedule should recreate the same stable AWS name.
    return createAwsScheduleForRelease(schedule);
  }

  return {
    name: result.name || scheduleName,
    arn: result.arn || schedule?.awsScheduleArn || null,
  };
}

export async function deleteAwsScheduleByName(scheduleName) {
  await invokeSchedulerManager(
    buildSchedulerManagerRequest({
      action: "delete",
      scheduleName,
    }),
  );
}
