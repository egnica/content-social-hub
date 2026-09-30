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
      state: "dispatching",
    },
    { projection: { _id: 1 } },
  );

  if (dispatching) {
    throw new TypeError(
      "This Facebook version is publishing now and cannot be edited until the scheduled dispatch finishes.",
    );
  }
}
