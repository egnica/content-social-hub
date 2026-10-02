import "server-only";

import { getDb } from "@/lib/mongodb";
import { refreshSocialConnectionHealth } from "@/lib/connections";
import {
  INSTAGRAM_RENEWAL_WINDOW_MS,
  INSTAGRAM_RENEWAL_RETRY_MS,
} from "@/lib/instagram-token-maintenance";
import { INSTAGRAM_RECOVERY_IDLE_MS } from "@/lib/instagram-recovery-logic";
import { recoverScheduledInstagramRelease } from "@/lib/scheduled-release-dispatch";

export async function runInstagramMaintenance() {
  const db = await getDb();
  const now = new Date();
  const retryBefore = new Date(now.getTime() - INSTAGRAM_RENEWAL_RETRY_MS);
  const idleBefore = new Date(now.getTime() - INSTAGRAM_RECOVERY_IDLE_MS);
  const connections = db.collection("social_connections");
  const schedules = db.collection("scheduled_releases");
  const summary = {
    action: "instagram_maintenance",
    connectionsChecked: 0,
    renewed: 0,
    needsAttention: 0,
    recovered: 0,
    processing: 0,
    reviewRequired: 0,
    errors: 0,
  };

  // One connection and one release per tick bounds provider work. Sort by last
  // check/recovery so a broken oldest item cannot starve the rest of the queue.
  const due = await connections
    .find({
      platform: "instagram",
      tokenExpiresAt: {
        $lte: new Date(now.getTime() + INSTAGRAM_RENEWAL_WINDOW_MS),
      },
      $and: [
        {
          $or: [
            { lastHealthCheckAt: null },
            { lastHealthCheckAt: { $lte: retryBefore } },
          ],
        },
        {
          $or: [
            { tokenRefreshAttemptAt: null },
            { tokenRefreshAttemptAt: { $lte: retryBefore } },
          ],
        },
      ],
    })
    .sort({ lastHealthCheckAt: 1 })
    .limit(1)
    .toArray();
  for (const connection of due) {
    const result = await refreshSocialConnectionHealth(
      connection._id.toString(),
    );
    summary.connectionsChecked++;
    if (result?.tokenRenewedAt && new Date(result.tokenRenewedAt) >= now)
      summary.renewed++;
    if (result?.healthStatus !== "healthy") summary.needsAttention++;
    if (result?.healthStatus === "api_error") summary.errors++;
  }

  const stalled = await schedules
    .find({
      platform: "instagram",
      active: true,
      state: "dispatching",
      updatedAt: { $lte: idleBefore },
      $or: [
        { recoveryLeaseUntil: null },
        { recoveryLeaseUntil: { $lte: now } },
      ],
    })
    .sort({ updatedAt: 1 })
    .limit(1)
    .toArray();
  for (const schedule of stalled) {
    const result = await recoverScheduledInstagramRelease(
      schedule._id.toString(),
      now,
    );
    if (result.outcome === "succeeded") summary.recovered++;
    if (result.outcome === "processing") summary.processing++;
    if (result.outcome === "review_required") summary.reviewRequired++;
    if (result.readFailed) summary.errors++;
  }
  return summary;
}
