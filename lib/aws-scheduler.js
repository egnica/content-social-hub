import "server-only";

import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@smithy/signature-v4";
import { createHash, createHmac } from "node:crypto";
import { getAwsRegion, requireEnv } from "@/lib/env";
import { buildAwsScheduleDefinition } from "@/lib/aws-scheduler-logic";

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
const hostname = `scheduler.${region}.amazonaws.com`;
const credentials = defaultProvider();
const signer = new SignatureV4({
  credentials,
  region,
  service: "scheduler",
  sha256: NodeSha256,
});

function config() {
  return {
    groupName: requireEnv("SCHEDULER_GROUP_NAME"),
    targetArn: requireEnv("SCHEDULED_RELEASE_WORKER_ARN"),
    targetRoleArn: requireEnv("SCHEDULER_TARGET_ROLE_ARN"),
  };
}

function schedulePath(name) {
  return `/schedules/${encodeURIComponent(name)}`;
}

async function schedulerRequest(method, path, { body, query } = {}) {
  const request = {
    protocol: "https:",
    hostname,
    method,
    path,
    headers: {
      host: hostname,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    query: query || {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const signed = await signer.sign(request);
  const url = new URL(`https://${hostname}${path}`);

  for (const [key, value] of Object.entries(signed.query || {})) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method,
    headers: signed.headers,
    body: signed.body,
    cache: "no-store",
  });
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const error = new Error(
      payload?.message || payload?.Message || `EventBridge Scheduler request failed (${response.status}).`,
    );
    error.name = String(
      payload?.__type || payload?.code || payload?.Code || "SchedulerRequestError",
    )
      .split("#")
      .pop();
    error.statusCode = response.status;
    throw error;
  }

  return payload || {};
}

function definitionFor(schedule, scheduleName) {
  const { groupName, targetArn, targetRoleArn } = config();
  return buildAwsScheduleDefinition({
    scheduledReleaseId: schedule?._id,
    platform: schedule?.platform,
    platformVersionId: schedule?.platformVersionId,
    releaseAt: schedule?.releaseAt,
    groupName,
    targetArn,
    targetRoleArn,
    scheduleName,
  });
}

export async function createAwsScheduleForRelease(schedule) {
  const definition = definitionFor(schedule);
  const { Name, ...body } = definition;

  try {
    const result = await schedulerRequest("POST", schedulePath(Name), { body });
    return { name: Name, arn: result.ScheduleArn || null };
  } catch (error) {
    if (error.statusCode !== 409 && error.name !== "ConflictException") {
      throw error;
    }

    await schedulerRequest("PUT", schedulePath(Name), { body });
    return { name: Name, arn: null };
  }
}

export async function updateAwsScheduleForRelease(schedule, scheduleName) {
  const definition = definitionFor(schedule, scheduleName);
  const { Name, ...body } = definition;
  await schedulerRequest("PUT", schedulePath(Name), { body });
  return { name: Name, arn: schedule?.awsScheduleArn || null };
}

export async function deleteAwsScheduleByName(scheduleName) {
  const normalizedName = String(scheduleName || "").trim();
  if (!normalizedName) return;

  try {
    await schedulerRequest("DELETE", schedulePath(normalizedName), {
      query: { groupName: config().groupName },
    });
  } catch (error) {
    if (error.statusCode === 404 || error.name === "ResourceNotFoundException") return;
    throw error;
  }
}
