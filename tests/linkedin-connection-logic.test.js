import test from "node:test";
import assert from "node:assert/strict";
import {
  getLinkedInHealth,
  linkedinProfileIdentity,
  normalizeLinkedInScopes,
} from "../lib/linkedin-connection-logic.js";

const scopes = ["openid", "profile", "w_member_social"];
const now = new Date("2026-10-12T12:00:00Z");

test("LinkedIn health is publishable when identity and posting scopes are present", () => {
  assert.deepEqual(getLinkedInHealth({
    grantedScopes: scopes, tokenExpiresAt: "2026-11-12T12:00:00Z", now,
  }), {
    healthStatus: "healthy",
    healthMessage: "",
    missingPermissions: [],
    canPublish: true,
  });
});

test("LinkedIn health requires a reliable identity scope", () => {
  const status = getLinkedInHealth({
    grantedScopes: ["w_member_social"], tokenExpiresAt: "2026-11-12T12:00:00Z", now,
  });
  assert.equal(status.healthStatus, "permission_problem");
  assert.equal(status.canPublish, false);
  assert.deepEqual(status.missingPermissions, ["openid", "profile"]);
});

test("LinkedIn health surfaces expiring and expired tokens without refresh assumptions", () => {
  const soon = getLinkedInHealth({
    grantedScopes: scopes, tokenExpiresAt: "2026-10-15T12:00:00Z", now,
  });
  assert.equal(soon.healthStatus, "expiring_soon");
  assert.equal(soon.canPublish, true);
  const expired = getLinkedInHealth({
    grantedScopes: scopes, tokenExpiresAt: "2026-10-11T12:00:00Z", now,
  });
  assert.equal(expired.healthStatus, "expired");
  assert.equal(expired.canPublish, false);
  const unknown = getLinkedInHealth({ grantedScopes: scopes, now });
  assert.equal(unknown.canPublish, false);
});

test("LinkedIn scopes normalize without duplicates", () => {
  assert.deepEqual(normalizeLinkedInScopes("openid profile w_member_social profile"), scopes);
});

test("LinkedIn profile identity uses member subject, not display name", () => {
  assert.deepEqual(linkedinProfileIdentity({
    sub: "member-123", given_name: "Nicholas", family_name: "Egner",
    picture: "https://example.com/avatar.png",
  }), {
    providerAccountId: "member-123",
    accountName: "Nicholas Egner",
    pictureUrl: "https://example.com/avatar.png",
  });
  assert.throws(() => linkedinProfileIdentity({ name: "Not Verified" }), /identity/);
});
