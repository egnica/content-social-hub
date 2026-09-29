import { apiError, readJson } from "@/lib/api";
import {
  cancelDestinationSchedule,
  createDestinationSchedule,
  getDestinationScheduleState,
  rescheduleDestinationSchedule,
} from "@/lib/scheduling";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function scheduleErrorResponse(error, fallbackMessage) {
  if (error instanceof TypeError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return apiError(error, fallbackMessage);
}

export async function GET(_request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    return Response.json({
      scheduleState: await getDestinationScheduleState(id),
    });
  } catch (error) {
    return scheduleErrorResponse(error, "Unable to load the Facebook schedule.");
  }
}

export async function POST(request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await readJson(request);
    const schedule = await createDestinationSchedule({
      platformVersionId: id,
      releaseSource: body?.releaseSource,
      destinationLocalDateTime: body?.destinationLocalDateTime,
    });

    return Response.json({
      schedule,
      scheduleState: await getDestinationScheduleState(id),
    });
  } catch (error) {
    return scheduleErrorResponse(
      error,
      "Unable to schedule this Facebook version.",
    );
  }
}

export async function PATCH(request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await readJson(request);
    const schedule = await rescheduleDestinationSchedule({
      platformVersionId: id,
      scheduleId: body?.scheduleId,
      releaseSource: body?.releaseSource,
      destinationLocalDateTime: body?.destinationLocalDateTime,
    });

    return Response.json({
      schedule,
      scheduleState: await getDestinationScheduleState(id),
    });
  } catch (error) {
    return scheduleErrorResponse(
      error,
      "Unable to reschedule this Facebook version.",
    );
  }
}

export async function DELETE(request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = await readJson(request);
    const schedule = await cancelDestinationSchedule({
      platformVersionId: id,
      scheduleId: body?.scheduleId,
    });

    return Response.json({
      schedule,
      scheduleState: await getDestinationScheduleState(id),
    });
  } catch (error) {
    return scheduleErrorResponse(error, "Unable to cancel this Facebook schedule.");
  }
}
