import assert from "node:assert/strict";
import test from "node:test";
import { getConnectionHealthDisplay } from "../lib/connection-health-display.js";

test("a renewable Google Business location remains visually healthy near routine access-token expiry", () => {
  assert.deepEqual(getConnectionHealthDisplay({ platform: "google_business_profile", healthStatus: "healthy" }),
    { label: "Healthy", healthy: true });
  assert.deepEqual(getConnectionHealthDisplay({ platform: "google_business_profile", healthStatus: "expiring_soon" }),
    { label: "Healthy", healthy: true });
});

test("revoked authorization, permission errors and API errors are never shown as healthy", () => {
  for (const [status, label] of [
    ["expired", "Expired"], ["disconnected", "Disconnected"],
    ["permission_problem", "Permission Problem"], ["api_error", "API Error"],
  ]) {
    assert.deepEqual(getConnectionHealthDisplay({ platform: "google_business_profile", healthStatus: status }),
      { label, healthy: false });
  }
});

test("other platforms retain their existing health labels", () => {
  assert.deepEqual(getConnectionHealthDisplay({ platform: "youtube", healthStatus: "expiring_soon" }),
    { label: "Expiring Soon", healthy: false });
  assert.deepEqual(getConnectionHealthDisplay({ platform: "facebook", healthStatus: "healthy" }),
    { label: "Healthy", healthy: true });
  assert.deepEqual(getConnectionHealthDisplay({ platform: "instagram", healthStatus: "unknown" }),
    { label: "Not checked", healthy: false });
});
