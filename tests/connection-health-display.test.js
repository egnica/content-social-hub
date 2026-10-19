import assert from "node:assert/strict";
import test from "node:test";
import { getConnectionHealthDisplay } from "../lib/connection-health-display.js";

test("renewable Google Business and YouTube access remains visually healthy near routine access-token expiry", () => {
  for (const platform of ["google_business_profile", "youtube"]) {
    assert.deepEqual(getConnectionHealthDisplay({ platform, healthStatus: "healthy" }),
      { label: "Healthy", healthy: true });
    assert.deepEqual(getConnectionHealthDisplay({ platform, healthStatus: "expiring_soon" }),
      { label: "Healthy", healthy: true });
  }
});

test("revoked authorization, permission problems and API errors remain visible for Google Business and YouTube", () => {
  for (const platform of ["google_business_profile", "youtube"]) {
    for (const [status, label] of [
      ["expired", "Expired"], ["disconnected", "Disconnected"],
      ["permission_problem", "Permission Problem"], ["api_error", "API Error"],
    ]) {
      assert.deepEqual(getConnectionHealthDisplay({ platform, healthStatus: status }),
        { label, healthy: false });
    }
  }
});

test("other platforms retain their existing health labels", () => {
  assert.deepEqual(getConnectionHealthDisplay({ platform: "linkedin", healthStatus: "expiring_soon" }),
    { label: "Expiring Soon", healthy: false });
  assert.deepEqual(getConnectionHealthDisplay({ platform: "facebook", healthStatus: "healthy" }),
    { label: "Healthy", healthy: true });
  assert.deepEqual(getConnectionHealthDisplay({ platform: "instagram", healthStatus: "unknown" }),
    { label: "Not checked", healthy: false });
});
