const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanText(value, maxLength = 10_000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanUrl(value) {
  const candidate = cleanText(value, 2_048);

  if (!candidate) {
    return "";
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

export function validateClientInput(input) {
  const client = {
    name: cleanText(input?.name, 160),
    website: cleanUrl(input?.website),
    timezone: cleanText(input?.timezone, 80) || "America/Chicago",
    approvalReportEmail: cleanText(input?.approvalReportEmail, 320).toLowerCase(),
    status: input?.status === "inactive" ? "inactive" : "active",
  };

  const errors = {};

  if (!client.name) {
    errors.name = "Client name is required.";
  }

  if (input?.website && !client.website) {
    errors.website = "Enter a valid website URL.";
  }

  if (
    client.approvalReportEmail &&
    !EMAIL_PATTERN.test(client.approvalReportEmail)
  ) {
    errors.approvalReportEmail = "Enter a valid email address.";
  }

  return { data: client, errors };
}

export function validateContentInput(input) {
  const content = {
    internalTitle: cleanText(input?.internalTitle, 220),
    clientId: cleanText(input?.clientId, 40),
    text: cleanText(input?.text, 50_000),
    primaryUrl: cleanUrl(input?.primaryUrl),
    contentLength: input?.contentLength === "long" ? "long" : "short",
    reusable: Boolean(input?.reusable),
    mediaIds: Array.isArray(input?.mediaIds)
      ? [...new Set(input.mediaIds.map((value) => cleanText(value, 40)).filter(Boolean))]
      : [],
    defaultPrimaryMediaId: cleanText(input?.defaultPrimaryMediaId, 40),
    defaultReleaseAt: cleanText(input?.defaultReleaseAt, 64),
  };

  const errors = {};

  if (!content.internalTitle) {
    errors.internalTitle = "Internal title is required.";
  }

  if (!content.clientId) {
    errors.clientId = "Choose a client.";
  }

  if (input?.primaryUrl && !content.primaryUrl) {
    errors.primaryUrl = "Enter a valid URL.";
  }

  if (
    content.defaultPrimaryMediaId &&
    !content.mediaIds.includes(content.defaultPrimaryMediaId)
  ) {
    errors.defaultPrimaryMediaId = "Choose media attached to this content.";
  }

  return { data: content, errors };
}

export function hasValidationErrors(errors) {
  return Object.keys(errors).length > 0;
}
