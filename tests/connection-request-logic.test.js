import assert from "node:assert/strict";
import test from "node:test";
import {
  createRequestedPlatformStatus,
  isConnectionRequestUsableForPlatform,
  markConnectionRequestPlatformConnected,
  normalizeConnectionRequestPlatforms,
  requestsSharePlatform,
} from "../lib/connection-request-logic.js";

test("normalizes legacy/default Facebook requests", () => {
  assert.deepEqual(normalizeConnectionRequestPlatforms(), ["facebook"]);
  assert.deepEqual(normalizeConnectionRequestPlatforms("FACEBOOK"), ["facebook"]);
});

test("accepts Instagram and deduplicates requested platforms", () => {
  assert.deepEqual(
    normalizeConnectionRequestPlatforms(["instagram", "facebook", "instagram"]),
    ["instagram", "facebook"],
  );
});

test("rejects unsupported requested platforms", () => {
  assert.throws(
    () => normalizeConnectionRequestPlatforms("linkedin"),
    /Unsupported connection request platform/,
  );
});

test("builds independent per-platform requested state", () => {
  assert.deepEqual(createRequestedPlatformStatus(["facebook", "instagram"]), {
    facebook: "requested",
    instagram: "requested",
  });
});

test("detects replacement overlap by requested platform", () => {
  assert.equal(requestsSharePlatform(["facebook"], ["instagram"]), false);
  assert.equal(requestsSharePlatform(["facebook"], ["facebook", "instagram"]), true);
});

test("request usability requires pending, unexpired, requested, unconnected platform", () => {
  const now = new Date("2026-10-01T15:00:00Z");
  const request = {
    status: "pending",
    expiresAt: "2026-10-02T15:00:00Z",
    requestedPlatforms: ["instagram"],
    platformStatus: { instagram: "requested" },
  };

  assert.equal(isConnectionRequestUsableForPlatform(request, "instagram", now), true);
  assert.equal(isConnectionRequestUsableForPlatform(request, "facebook", now), false);
  assert.equal(
    isConnectionRequestUsableForPlatform(
      { ...request, platformStatus: { instagram: "connected" } },
      "instagram",
      now,
    ),
    false,
  );
  assert.equal(
    isConnectionRequestUsableForPlatform(
      { ...request, expiresAt: "2026-09-30T15:00:00Z" },
      "instagram",
      now,
    ),
    false,
  );
});

test("completion stays pending until every requested platform is connected", () => {
  const request = {
    requestedPlatforms: ["facebook", "instagram"],
    platformStatus: { facebook: "connected", instagram: "requested" },
  };

  assert.deepEqual(markConnectionRequestPlatformConnected(request, "instagram"), {
    platformStatus: { facebook: "connected", instagram: "connected" },
    status: "completed",
    completed: true,
  });
  assert.deepEqual(
    markConnectionRequestPlatformConnected(
      {
        requestedPlatforms: ["facebook", "instagram"],
        platformStatus: { facebook: "requested", instagram: "requested" },
      },
      "instagram",
    ),
    {
      platformStatus: { facebook: "requested", instagram: "connected" },
      status: "pending",
      completed: false,
    },
  );
});
