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

function platformLabel(platform) {
  return platform === "instagram"
    ? "Instagram Professional account"
    : "Facebook Page";
}

function joinLabels(values) {
  if (values.length <= 1) return values[0] || "social account";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

export async function sendConnectionRequestEmail({
  to,
  clientName,
  setupUrl,
  expiresAt,
  requestedPlatforms = ["facebook"],
}) {
  const apiKey = requireEnv("RESEND_API_KEY");
  const from = requireEnv("EMAIL_FROM");
  const replyTo = process.env.EMAIL_REPLY_TO?.trim();
  const labels = requestedPlatforms.map(platformLabel);
  const requestedLabel = joinLabels(labels);
  const safeClientName = escapeHtml(clientName);
  const safeSetupUrl = escapeHtml(setupUrl);
  const safeRequestedLabel = escapeHtml(requestedLabel);
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
      subject: `Connect ${clientName}'s ${requestedLabel}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#17211b;line-height:1.6">
          <h1 style="font-size:26px;margin-bottom:12px">Connect your social account</h1>
          <p>Content Social Hub needs authorization to connect the correct <strong>${safeRequestedLabel}</strong> for <strong>${safeClientName}</strong>.</p>
          <p>This link opens a limited setup page. It does not provide access to the publishing workspace.</p>
          <p style="margin:28px 0">
            <a href="${safeSetupUrl}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#176b45;color:#fff;text-decoration:none;font-weight:700">Open Connection Setup</a>
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
