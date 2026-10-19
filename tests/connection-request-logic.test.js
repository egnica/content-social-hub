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
    () => normalizeConnectionRequestPlatforms("tiktok"),
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


test("YouTube request link is scoped to platform, expiry and replacement state", () => {
  const now = new Date("2026-10-13T17:00:00Z");
  assert.deepEqual(normalizeConnectionRequestPlatforms("youtube"), ["youtube"]);
  assert.equal(requestsSharePlatform(["youtube"], ["linkedin"]), false);
  assert.equal(requestsSharePlatform(["youtube"], ["youtube"]), true);
  const request = { status: "pending", requestedPlatforms: ["youtube"],
    platformStatus: { youtube: "requested" }, expiresAt: "2026-10-15T17:00:00Z" };
  assert.equal(isConnectionRequestUsableForPlatform(request, "youtube", now), true);
  assert.equal(isConnectionRequestUsableForPlatform(request, "linkedin", now), false);
  assert.equal(isConnectionRequestUsableForPlatform({ ...request, status: "revoked" }, "youtube", now), false);
  assert.equal(isConnectionRequestUsableForPlatform({ ...request, status: "completed" }, "youtube", now), false);
  assert.equal(isConnectionRequestUsableForPlatform({ ...request, expiresAt: "2026-10-12T00:00:00Z" }, "youtube", now), false);
  assert.equal(markConnectionRequestPlatformConnected(request, "youtube").status, "completed");
});


test("Google Business requests retain replacement, expiration and multi-platform completion guards", () => {
  const now = new Date("2026-10-19T20:00:00Z");
  const request = { status: "pending", requestedPlatforms: ["facebook", "google_business_profile"],
    platformStatus: { facebook: "requested", google_business_profile: "requested" },
    expiresAt: "2026-10-21T20:00:00Z" };
  assert.deepEqual(normalizeConnectionRequestPlatforms("GOOGLE_BUSINESS_PROFILE"), ["google_business_profile"]);
  assert.equal(requestsSharePlatform(["google_business_profile"], ["instagram"]), false);
  assert.equal(requestsSharePlatform(["youtube", "google_business_profile"], ["google_business_profile"]), true);
  assert.equal(isConnectionRequestUsableForPlatform(request, "google_business_profile", now), true);
  assert.equal(isConnectionRequestUsableForPlatform({ ...request, status: "revoked" }, "google_business_profile", now), false);
  assert.equal(isConnectionRequestUsableForPlatform({ ...request, expiresAt: "2026-10-18T20:00:00Z" }, "google_business_profile", now), false);
  const next = markConnectionRequestPlatformConnected(request, "google_business_profile");
  assert.equal(next.status, "pending");
  assert.deepEqual(next.platformStatus, { facebook: "requested", google_business_profile: "connected" });
  assert.equal(markConnectionRequestPlatformConnected({ ...request, platformStatus:
    { facebook: "connected", google_business_profile: "requested" } }, "google_business_profile").status, "completed");
});
