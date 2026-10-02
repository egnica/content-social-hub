import "server-only";

import { getDb } from "@/lib/mongodb";
import { toObjectId } from "@/lib/ids";

export async function assertDestinationNotDispatching(platformVersionId) {
  const versionId = toObjectId(platformVersionId);
  if (!versionId) return;

  const db = await getDb();
  const dispatching = await db.collection("scheduled_releases").findOne(
    {
      platformVersionId: versionId,
      active: true,
      state: { $in: ["dispatching", "review_required"] },
    },
    { projection: { _id: 1 } },
  );

  if (dispatching) {
    throw new TypeError(
      "This destination version is publishing or awaiting review and cannot be edited until its recorded dispatch is resolved.",
    );
  }
}

export async function assertDestinationNotAwaitingReview(platformVersionId) {
  const versionId = toObjectId(platformVersionId);
  if (!versionId) return;
  const db = await getDb();
  const unresolved = await db.collection("scheduled_releases").findOne({
    platformVersionId: versionId, active: true, state: "review_required",
  });
  if (unresolved) throw new TypeError("This destination has an unresolved scheduled submission. Review its recorded result before publishing again.");
}
