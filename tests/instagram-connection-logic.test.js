import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInstagramConnectionIdentity,
  getInstagramHealth,
  getInstagramProviderAccountId,
  INSTAGRAM_REQUIRED_PERMISSIONS,
  normalizeInstagramPermissions,
} from "../lib/instagram-connection-logic.js";

test("Instagram required scopes include basic account access and publishing", () => {
  assert.deepEqual(INSTAGRAM_REQUIRED_PERMISSIONS, [
    "instagram_business_basic",
    "instagram_business_content_publish",
  ]);
});

test("Instagram permission normalization accepts Meta's comma-separated token response", () => {
  assert.deepEqual(
    normalizeInstagramPermissions(
      "instagram_business_basic, instagram_business_content_publish",
    ),
    ["instagram_business_basic", "instagram_business_content_publish"],
  );
});

test("Instagram profile identity prefers the Professional account user_id over the graph-scoped id", () => {
  assert.equal(
    getInstagramProviderAccountId({ id: "graph-scoped", user_id: "17841400123456789" }),
    "17841400123456789",
  );
});

test("Instagram profile identity safely falls back to id when user_id is unavailable", () => {
  assert.equal(
    getInstagramProviderAccountId({ id: "17841400123456789" }),
    "17841400123456789",
  );
});

test("Instagram connection identity stays isolated by client, platform, and provider account", () => {
  assert.deepEqual(buildInstagramConnectionIdentity("client-a", "1789"), {
    clientId: "client-a",
    platform: "instagram",
    providerAccountId: "1789",
  });
  assert.notDeepEqual(
    buildInstagramConnectionIdentity("client-a", "1789"),
    buildInstagramConnectionIdentity("client-b", "1789"),
  );
});

test("Instagram health is healthy only for a Professional account with both required scopes", () => {
  assert.deepEqual(
    getInstagramHealth({
      grantedScopes: INSTAGRAM_REQUIRED_PERMISSIONS,
      accountType: "BUSINESS",
      tokenExpiresAt: new Date("2026-12-01T00:00:00Z"),
      now: new Date("2026-09-30T00:00:00Z"),
    }),
    {
      healthStatus: "healthy",
      healthMessage: "",
      missingPermissions: [],
      canPublish: true,
    },
  );
});

test("Instagram health refuses publishing when content-publish permission is missing", () => {
  const health = getInstagramHealth({
    grantedScopes: ["instagram_business_basic"],
    accountType: "MEDIA_CREATOR",
    tokenExpiresAt: new Date("2026-12-01T00:00:00Z"),
    now: new Date("2026-09-30T00:00:00Z"),
  });

  assert.equal(health.healthStatus, "permission_problem");
  assert.equal(health.canPublish, false);
  assert.deepEqual(health.missingPermissions, [
    "instagram_business_content_publish",
  ]);
});

test("Instagram health refuses non-Professional accounts", () => {
  const health = getInstagramHealth({
    grantedScopes: INSTAGRAM_REQUIRED_PERMISSIONS,
    accountType: "PERSONAL",
  });

  assert.equal(health.healthStatus, "permission_problem");
  assert.equal(health.canPublish, false);
});

test("Instagram health reports expired tokens safely", () => {
  const health = getInstagramHealth({
    grantedScopes: INSTAGRAM_REQUIRED_PERMISSIONS,
    accountType: "CREATOR",
    tokenExpiresAt: new Date("2026-09-01T00:00:00Z"),
    now: new Date("2026-09-30T00:00:00Z"),
  });

  assert.equal(health.healthStatus, "expired");
  assert.equal(health.canPublish, false);
});
