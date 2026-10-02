import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createHash, timingSafeEqual } from "node:crypto";
import { loadWithStubs } from "./helpers/load-with-stubs.js";

async function worker(responses) {
  const template = await readFile(
    new URL("../infrastructure/level4-scheduling.yaml", import.meta.url),
    "utf8",
  );
  const source = template
    .split("        ZipFile: |\n")[1]
    .split("\n  SchedulerTargetRole:")[0]
    .split("\n")
    .map((line) => line.slice(10))
    .join("\n");
  const calls = [];
  const logs = [];
  const context = {
    exports: {},
    process: { env: { WORKER_CONFIG_SECRET_ARN: "test-secret" } },
    require: () => ({
      GetSecretValueCommand: class {},
      SecretsManagerClient: class {
        async send() {
          return {
            SecretString: JSON.stringify({
              dispatchUrl:
                "https://example.test/api/internal/scheduled-releases/dispatch",
              dispatchToken: "private-worker-token",
            }),
          };
        }
      },
    }),
    fetch: async (url, options) => {
      calls.push({ url, options });
      return Response.json(responses.shift());
    },
    console: { log: (value) => logs.push(value) },
    Date,
    AbortSignal,
    setTimeout: (fn) => fn(),
  };
  vm.runInNewContext(source, context);
  return { handler: context.exports.handler, calls, logs };
}

test("maintenance worker routes only its authenticated action, returns counters and never invents a release ID", async () => {
  const w = await worker([{ action: "instagram_maintenance", renewed: 1, recovered: 1, errors: 0 }]);
  const result = await w.handler({ action: "instagram_maintenance" });
  assert.equal(result.renewed, 1);
  assert.deepEqual(JSON.parse(w.calls[0].options.body), {
    action: "instagram_maintenance",
  });
  assert.equal(
    w.calls[0].options.headers.authorization,
    "Bearer private-worker-token",
  );
  assert.equal(w.logs.join("").includes("private-worker-token"), false);
  await assert.rejects(w.handler({ action: "other" }), /Unsupported/);
  await assert.rejects(
    w.handler({
      action: "instagram_maintenance",
      scheduledReleaseId: "a".repeat(24),
    }),
    /Unsupported/,
  );
  assert.equal(w.calls.length, 1);
});

test("maintenance read errors fail the Lambda invocation for the worker error alarm", async () => {
  const w = await worker([{ action: "instagram_maintenance", errors: 1 }]);
  await assert.rejects(
    w.handler({ action: "instagram_maintenance" }),
    /reported/,
  );
});

test("normal scheduled worker keeps polling the same ID and exits on its terminal result", async () => {
  const w = await worker([{ outcome: "processing" }, { outcome: "succeeded" }]);
  assert.equal(
    (await w.handler({ scheduledReleaseId: "a".repeat(24) })).outcome,
    "succeeded",
  );
  assert.equal(w.calls.length, 2);
  assert.deepEqual(
    w.calls.map((call) => JSON.parse(call.options.body)),
    Array(2).fill({ scheduledReleaseId: "a".repeat(24) }),
  );
});

test("maintenance dispatch shares the existing bearer check; unauthorized requests never run maintenance", async () => {
  const saved = process.env.SCHEDULED_RELEASE_DISPATCH_TOKEN_SHA256;
  process.env.SCHEDULED_RELEASE_DISPATCH_TOKEN_SHA256 = createHash("sha256")
    .update("worker-token")
    .digest("hex");
  let runs = 0;
  const route = await loadWithStubs(
    new URL(
      "../app/api/internal/scheduled-releases/dispatch/route.js",
      import.meta.url,
    ),
    {
      createHash,
      timingSafeEqual,
      readJson: (request) => request.json(),
      apiError: () => Response.json({}, { status: 500 }),
      runInstagramMaintenance: async () => {
        runs++;
        return { renewed: 1 };
      },
      dispatchScheduledRelease: async () => ({ outcome: "succeeded" }),
    },
  );
  const request = (token, body) =>
    new Request(
      "https://example.test/api/internal/scheduled-releases/dispatch",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  try {
    assert.equal(
      (await route.POST(request("wrong", { action: "instagram_maintenance" })))
        .status,
      401,
    );
    assert.equal(runs, 0);
    assert.deepEqual(
      await (
        await route.POST(
          request("worker-token", { action: "instagram_maintenance" }),
        )
      ).json(),
      { renewed: 1 },
    );
    assert.equal(runs, 1);
    assert.equal(
      (await route.POST(request("worker-token", { action: "unsupported" })))
        .status,
      400,
    );
  } finally {
    if (saved === undefined)
      delete process.env.SCHEDULED_RELEASE_DISPATCH_TOKEN_SHA256;
    else process.env.SCHEDULED_RELEASE_DISPATCH_TOKEN_SHA256 = saved;
  }
});


test("maintenance rejects an older application handler instead of silently succeeding", async () => {
  const w = await worker([{ outcome: "noop", reason: "invalid_schedule_id" }]);
  await assert.rejects(w.handler({ action: "instagram_maintenance" }), /not deployed/);
});
