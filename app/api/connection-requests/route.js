import { apiError, readJson } from "@/lib/api";
import {
  createConnectionRequest,
  recordEmailLog,
  setConnectionRequestEmailResult,
} from "@/lib/connections";
import { sendConnectionRequestEmail } from "@/lib/email";
import { requireEnv } from "@/lib/env";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  let created;

  try {
    const body = await readJson(request);
    created = await createConnectionRequest(body?.clientId);
    const setupUrl = `${requireEnv("APP_BASE_URL").replace(/\/$/, "")}/connect/${created.token}`;
    const email = await sendConnectionRequestEmail({
      to: created.request.email,
      clientName: created.client.name,
      setupUrl,
      expiresAt: new Date(created.request.expiresAt),
    });

    await Promise.all([
      setConnectionRequestEmailResult(created.request._id, {
        status: "sent",
        providerMessageId: email.id || "",
      }),
      recordEmailLog({
        type: "connection_request",
        clientId: created.client._id,
        requestId: created.request._id,
        recipient: created.request.email,
        status: "sent",
        providerMessageId: email.id || "",
      }),
    ]);

    return Response.json(
      {
        request: {
          ...created.request,
          emailStatus: "sent",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (created) {
      await Promise.allSettled([
        setConnectionRequestEmailResult(created.request._id, {
          status: "failed",
          errorMessage: error.message,
        }),
        recordEmailLog({
          type: "connection_request",
          clientId: created.client._id,
          requestId: created.request._id,
          recipient: created.request.email,
          status: "failed",
          errorMessage: error.message,
        }),
      ]);
    }

    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return apiError(error, "Unable to send the connection request.");
  }
}
