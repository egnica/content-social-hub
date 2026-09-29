export function uniquePublishMediaIds(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function validHttpUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateFacebookTextLinkPublish({
  message = "",
  destinationUrl = "",
  mediaIds = [],
  healthStatus = "healthy",
  canPublish = true,
  active = true,
} = {}) {
  const blocking = [];
  const trimmedMessage = String(message || "").trim();
  const trimmedUrl = String(destinationUrl || "").trim();
  const selectedMediaIds = uniquePublishMediaIds(mediaIds);

  if (!active) {
    blocking.push("This Facebook destination is excluded and cannot be published.");
  }
  if (healthStatus !== "healthy" || canPublish !== true) {
    blocking.push("The Facebook destination is not currently healthy and publishable.");
  }
  if (!trimmedMessage && !trimmedUrl) {
    blocking.push("Add a Facebook message or destination URL before publishing.");
  }
  if (trimmedUrl && !validHttpUrl(trimmedUrl)) {
    blocking.push("Use a valid http or https destination URL.");
  }
  if (selectedMediaIds.length) {
    blocking.push(
      "Remove selected Facebook media for this first text/link publish. Image and video publishing are handled by later Level 3 tasks.",
    );
  }

  return { blocking, publishable: blocking.length === 0 };
}

export function buildFacebookFeedPayload({ message = "", destinationUrl = "" } = {}) {
  const payload = {};
  const trimmedMessage = String(message || "").trim();
  const trimmedUrl = String(destinationUrl || "").trim();

  if (trimmedMessage) payload.message = trimmedMessage;
  if (trimmedUrl) payload.link = trimmedUrl;
  return payload;
}

export function createFacebookPublishIdempotencyKey(versionId, revision) {
  const id = String(versionId || "").trim();
  const normalizedRevision = Number(revision);
  if (!id || !Number.isInteger(normalizedRevision) || normalizedRevision < 1) {
    throw new TypeError("A valid Facebook version and revision are required.");
  }
  return `facebook:${id}:r${normalizedRevision}`;
}

export function buildFacebookPostUrl(pageId, providerPostId) {
  const page = String(pageId || "").trim();
  const providerId = String(providerPostId || "").trim();
  if (!providerId) return "";

  const separator = providerId.indexOf("_");
  const postId = separator >= 0 ? providerId.slice(separator + 1) : providerId;
  if (page && postId) {
    return `https://www.facebook.com/${encodeURIComponent(page)}/posts/${encodeURIComponent(postId)}`;
  }
  return `https://www.facebook.com/${encodeURIComponent(providerId)}`;
}

export function sanitizeFacebookProviderError(error) {
  const details = error?.details || {};
  const safeMessage = String(details.message || error?.message || "Facebook publishing failed.")
    .replace(/access[_ -]?token\s*[=:]\s*[^\s&,]+/gi, "access_token=[redacted]")
    .replace(/appsecret[_ -]?proof\s*[=:]\s*[^\s&,]+/gi, "appsecret_proof=[redacted]")
    .slice(0, 500);

  return {
    message: safeMessage,
    type: details.type ? String(details.type).slice(0, 100) : "",
    code: Number.isFinite(Number(details.code)) ? Number(details.code) : null,
    errorSubcode: Number.isFinite(Number(details.error_subcode))
      ? Number(details.error_subcode)
      : null,
    isTransient: details.is_transient === true,
    traceId: details.fbtrace_id ? String(details.fbtrace_id).slice(0, 150) : "",
  };
}
