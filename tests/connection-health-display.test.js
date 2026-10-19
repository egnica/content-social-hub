import assert from "node:assert/strict";
import test from "node:test";
import { getConnectionHealthDisplay, getConnectionReconnectUrl } from "../lib/connection-health-display.js";

const now = "2026-10-19T19:00:00.000Z";
const recent = "2026-10-19T18:00:00.000Z";

test("all five platforms share Healthy display and fresh check state", () => {
  for (const platform of ["facebook", "instagram", "linkedin", "youtube", "google_business_profile"]) {
    assert.deepEqual(getConnectionHealthDisplay({ platform, healthStatus: "healthy", lastHealthCheckAt: recent }, { now }),
      { label: "Healthy", healthy: true, needsAttention: false, stale: false });
  }
});

test("renewable Google access remains Healthy near routine token expiry", () => {
  for (const platform of ["youtube", "google_business_profile"]) {
    assert.equal(getConnectionHealthDisplay({ platform, healthStatus: "expiring_soon" }, { now }).label, "Healthy");
  }
  assert.equal(getConnectionHealthDisplay({ platform: "linkedin", healthStatus: "expiring_soon" }, { now }).label, "Needs attention");
});

test("genuine health failures remain distinct", () => {
  for (const platform of ["facebook", "instagram", "linkedin", "youtube", "google_business_profile"]) {
    for (const [healthStatus, label] of [
      ["expired", "Expired"], ["permission_problem", "Needs attention"],
      ["disconnected", "Needs attention"], ["api_error", "Error"],
    ]) {
      const state = getConnectionHealthDisplay({ platform, healthStatus }, { now });
      assert.equal(state.label, label);
      assert.equal(state.needsAttention, true);
      assert.equal(state.healthy, false);
    }
  }
});

test("old checks are explicitly stale without fabricating a revoked connection", () => {
  const old = getConnectionHealthDisplay({ platform: "facebook", healthStatus: "healthy", lastHealthCheckAt: "2026-10-09T15:00:00Z" }, { now });
  assert.equal(old.healthy, true);
  assert.equal(old.stale, true);
  assert.equal(getConnectionHealthDisplay({ platform: "facebook", healthStatus: "healthy", lastHealthCheckAt: recent }, { now }).stale, false);
  assert.equal(getConnectionHealthDisplay({ healthStatus: "healthy", lastHealthCheckAt: "bad" }, { now }).stale, true);
});

test("reconnect is only offered for identity-safe per-account flows", () => {
  for (const platform of ["facebook", "instagram", "unknown"]) {
    assert.equal(getConnectionReconnectUrl({ _id: "a", clientId: "b", platform }), null);
  }
  for (const [platform, part] of [["linkedin", "linkedin"], ["youtube", "youtube"], ["google_business_profile", "google-business"]]) {
    assert.equal(getConnectionReconnectUrl({ _id: "abc", clientId: "owner", platform }),
      `/api/connections/${part}/start?clientId=owner&connectionId=abc`);
  }
  assert.equal(getConnectionReconnectUrl({ platform: "youtube", _id: "abc" }), null);
});
