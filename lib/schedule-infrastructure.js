import "server-only";

import { getDb } from "@/lib/mongodb";
import { toObjectId } from "@/lib/ids";
import {
  cancelDestinationSchedule,
  createDestinationSchedule,
  getScheduleById,
  rescheduleDestinationSchedule,
} from "@/lib/scheduling";
import {
  createAwsScheduleForRelease,
  deleteAwsScheduleByName,
  updateAwsScheduleForRelease,
} from "@/lib/aws-scheduler";

async function schedulesCollection() {
  return (await getDb()).collection("scheduled_releases");
}

async function linkAwsSchedule(schedule, awsSchedule) {
  const scheduleId = toObjectId(schedule?._id);
  if (!scheduleId) throw new Error("Scheduled release could not be linked to AWS.");

  const schedules = await schedulesCollection();
  const linked = await schedules.findOneAndUpdate(
    { _id: scheduleId, active: true, state: "scheduled", dispatchedAt: null },
    {
      $set: {
        awsScheduleId: awsSchedule.name,
        awsScheduleArn: awsSchedule.arn || null,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!linked) {
    throw new Error(
      "The scheduled release changed before AWS could be linked. Refresh and try again.",
    );
  }

  return {
    ...schedule,
    awsScheduleId: awsSchedule.name,
    awsScheduleArn: awsSchedule.arn || null,
  };
}

async function removeNewScheduleRecord(scheduleId) {
  const objectId = toObjectId(scheduleId);
  if (!objectId) return;
  const schedules = await schedulesCollection();
  await schedules.deleteOne({
    _id: objectId,
    active: true,
    state: "scheduled",
    dispatchedAt: null,
  });
}

async function restoreSupersededSchedule(previous, replacementId) {
  const previousId = toObjectId(previous?._id);
  const newId = toObjectId(replacementId);
  if (!previousId || !newId) return;

  const schedules = await schedulesCollection();
  await schedules.deleteOne({
    _id: newId,
    active: true,
    state: "scheduled",
    dispatchedAt: null,
  });
  await schedules.updateOne(
    {
      _id: previousId,
      state: "superseded",
      active: false,
      dispatchedAt: null,
      supersededByScheduleId: newId,
    },
    {
      $set: {
        state: "scheduled",
        active: true,
        supersededAt: null,
        supersededByScheduleId: null,
        updatedAt: new Date(),
      },
    },
  );
}

async function restoreCancelledSchedule(cancelled) {
  const scheduleId = toObjectId(cancelled?._id);
  if (!scheduleId) return;

  const schedules = await schedulesCollection();
  await schedules.updateOne(
    {
      _id: scheduleId,
      state: "cancelled",
      active: false,
      dispatchedAt: null,
    },
    {
      $set: {
        state: "scheduled",
        active: true,
        cancelledAt: null,
        updatedAt: new Date(),
      },
    },
  );
}

export async function createDestinationScheduleWithInfrastructure(input) {
  const schedule = await createDestinationSchedule(input);
  let awsSchedule = null;

  try {
    awsSchedule = await createAwsScheduleForRelease(schedule);
    return await linkAwsSchedule(schedule, awsSchedule);
  } catch (error) {
    if (awsSchedule?.name) {
      await deleteAwsScheduleByName(awsSchedule.name).catch(() => {});
    }
    await removeNewScheduleRecord(schedule._id).catch(() => {});
    throw error;
  }
}

export async function rescheduleDestinationScheduleWithInfrastructure(input) {
  const previous = await getScheduleById(input?.scheduleId);
  if (!previous) throw new TypeError("Scheduled release not found.");

  const replacement = await rescheduleDestinationSchedule(input);
  let awsSchedule = null;
  let awsChanged = false;

  try {
    if (previous.awsScheduleId) {
      awsSchedule = await updateAwsScheduleForRelease(
        replacement,
        previous.awsScheduleId,
      );
    } else {
      awsSchedule = await createAwsScheduleForRelease(replacement);
    }
    awsChanged = true;
    return await linkAwsSchedule(replacement, awsSchedule);
  } catch (error) {
    if (awsChanged) {
      if (previous.awsScheduleId) {
        await updateAwsScheduleForRelease(previous, previous.awsScheduleId).catch(
          () => {},
        );
      } else if (awsSchedule?.name) {
        await deleteAwsScheduleByName(awsSchedule.name).catch(() => {});
      }
    }
    await restoreSupersededSchedule(previous, replacement._id).catch(() => {});
    throw error;
  }
}

export async function cancelDestinationScheduleWithInfrastructure(input) {
  const previous = await getScheduleById(input?.scheduleId);
  if (!previous) throw new TypeError("Scheduled release not found.");

  const cancelled = await cancelDestinationSchedule(input);

  try {
    if (previous.awsScheduleId) {
      await deleteAwsScheduleByName(previous.awsScheduleId);
    }
    return cancelled;
  } catch (error) {
    await restoreCancelledSchedule(cancelled).catch(() => {});
    throw error;
  }
}
