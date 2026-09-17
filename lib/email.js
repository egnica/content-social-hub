import "server-only";

import { requireEnv } from "@/lib/env";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendConnectionRequestEmail({
  to,
  clientName,
  setupUrl,
  expiresAt,
}) {
  const apiKey = requireEnv("RESEND_API_KEY");
  const from = requireEnv("EMAIL_FROM");
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  const safeClientName = escapeHtml(clientName);
  const safeSetupUrl = escapeHtml(setupUrl);
  const safeExpiration = escapeHtml(
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Chicago",
    }).format(expiresAt),
  );

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo || undefined,
      subject: `Connect ${clientName}'s Facebook Page`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#17211b;line-height:1.6">
          <h1 style="font-size:26px;margin-bottom:12px">Connect your Facebook Page</h1>
          <p>Content Social Hub needs authorization to connect the correct Facebook Page for <strong>${safeClientName}</strong>.</p>
          <p>This link opens a limited setup page. It does not provide access to the publishing workspace.</p>
          <p style="margin:28px 0">
            <a href="${safeSetupUrl}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#176b45;color:#fff;text-decoration:none;font-weight:700">Connect Facebook Page</a>
          </p>
          <p style="font-size:13px;color:#67736b">For security, this link expires ${safeExpiration} and becomes unusable after setup is completed or replaced.</p>
        </div>
      `,
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    throw new Error(
      payload?.message || payload?.error?.message || "Resend could not send the email.",
    );
  }

  return payload;
}
