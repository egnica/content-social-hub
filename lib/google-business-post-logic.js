// Google Business Profile STANDARD draft rules. No provider API calls here.
// https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts
// https://support.google.com/business/answer/6123536
export const GOOGLE_BUSINESS_CTA_TYPES = Object.freeze([
  "BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP", "CALL",
]);
const LINK_CTA_TYPES = new Set(GOOGLE_BUSINESS_CTA_TYPES.filter((item) => item !== "CALL"));
const IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIN_IMAGE_BYTES = 10 * 1024;

export function validGoogleBusinessUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const result = new URL(value.trim());
    return ["http:", "https:"].includes(result.protocol) && Boolean(result.hostname);
  } catch {
    return false;
  }
}

export function isEditableGoogleBusinessConnection(connection, clientId) {
  return Boolean(
    connection && clientId &&
    connection.platform === "google_business_profile" &&
    String(connection.clientId || "") === String(clientId) &&
    connection.healthStatus === "healthy" &&
    /^accounts\/[^/]+\/locations\/[^/]+$/.test(String(connection.providerAccountId || "")),
  );
}

export function googleBusinessImageCompatible(asset) {
  if (!asset || !IMAGE_TYPES.has(String(asset.contentType || ""))) return false;
  if (Number.isFinite(Number(asset.size)) && Number(asset.size) > 0 &&
      (Number(asset.size) < MIN_IMAGE_BYTES || Number(asset.size) > MAX_IMAGE_BYTES)) return false;
  if (Number(asset.width) > 0 && Number(asset.width) < 250) return false;
  if (Number(asset.height) > 0 && Number(asset.height) < 250) return false;
  return true;
}

export function buildInheritedGoogleBusinessFields(content, media = []) {
  const attached = new Set((content?.mediaIds || []).map(String));
  const options = media.filter((asset) =>
    attached.has(String(asset._id)) && googleBusinessImageCompatible(asset));
  const preferred = options.find((asset) =>
    String(asset._id) === String(content?.defaultPrimaryMediaId || "")) || options[0];
  const primaryUrl = String(content?.primaryUrl || "").trim();
  const usableLink = validGoogleBusinessUrl(primaryUrl);
  const mediaId = preferred ? String(preferred._id) : "";
  return {
    summary: String(content?.text || ""),
    ctaType: usableLink ? "LEARN_MORE" : "",
    ctaUrl: usableLink ? primaryUrl : "",
    mediaIds: mediaId ? [mediaId] : [],
    primaryMediaId: mediaId,
    releaseSource: "master",
    destinationLocalDateTime: "",
    masterRevisionSynced: Number.isInteger(content?.revision) ? content.revision : 1,
    customized: false,
  };
}

export function isGoogleBusinessVersionOutOfSync(version, masterRevision) {
  return Number(version?.masterRevisionSynced || 0) !== Number(masterRevision || 0);
}

export function normalizeGoogleBusinessDraft(input, allowedMedia = []) {
  const suppliedIds = Array.isArray(input?.mediaIds) ? input.mediaIds.map(String) : [];
  if (suppliedIds.length > 1 || new Set(suppliedIds).size !== suppliedIds.length) {
    throw new TypeError("Choose no more than one Google Business Profile image.");
  }
  const allowed = new Map(allowedMedia.map((asset) => [String(asset._id), asset]));
  if (suppliedIds.some((id) => !allowed.has(id))) {
    throw new TypeError("The Google image must be attached, uploaded and owned by this client.");
  }
  if (suppliedIds.length && !googleBusinessImageCompatible(allowed.get(suppliedIds[0]))) {
    throw new TypeError("Google images must be compatible JPG or PNG files (10 KB–5 MB, at least 250 × 250 px).");
  }
  const ctaType = String(input?.ctaType || "").trim();
  const ctaUrl = String(input?.ctaUrl || "").trim();
  const releaseSource = input?.releaseSource === "destination_override" ? "destination_override" : "master";
  const destinationLocalDateTime = releaseSource === "destination_override"
    ? String(input?.destinationLocalDateTime || "").trim() : "";
  return {
    summary: typeof input?.summary === "string" ? input.summary : "",
    ctaType,
    ctaUrl,
    mediaIds: suppliedIds,
    primaryMediaId: suppliedIds[0] || "",
    releaseSource,
    destinationLocalDateTime,
  };
}

export function validateGoogleBusinessDraft(input, media = []) {
  const blocking = [];
  const warnings = [];
  const summary = String(input?.summary || "");
  const ctaType = String(input?.ctaType || "");
  const ctaUrl = String(input?.ctaUrl || "").trim();
  const selected = Array.isArray(input?.mediaIds) ? input.mediaIds.map(String) : [];
  const available = new Map(media.map((asset) => [String(asset._id), asset]));
  if (!summary.trim()) blocking.push("Write a summary for this Google standard update.");
  // 1,500 is a conservative editor limit, not a claim of a documented API schema maximum.
  if ([...summary].length > 1500) blocking.push("Keep the Google update summary at or below 1,500 characters.");
  if (ctaType && !GOOGLE_BUSINESS_CTA_TYPES.includes(ctaType)) {
    blocking.push("Choose a supported Google Business Profile action.");
  }
  if (LINK_CTA_TYPES.has(ctaType) && !validGoogleBusinessUrl(ctaUrl)) {
    blocking.push("A link action needs a valid http:// or https:// URL.");
  }
  if ((!ctaType || ctaType === "CALL") && ctaUrl) {
    blocking.push("Remove the URL when using no button or the Call button.");
  }
  if (selected.length > 1 || selected.some((id) =>
    !available.has(id) || !googleBusinessImageCompatible(available.get(id)))) {
    blocking.push("Choose one attached JPG or PNG image, 10 KB–5 MB and at least 250 × 250 px, or no image.");
  }
  if (input?.releaseSource === "destination_override" &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(input?.destinationLocalDateTime || ""))) {
    blocking.push("Choose a local date and time for the destination override.");
  }
  if (input?.masterChanged) {
    warnings.push(input?.customized
      ? "Shared content changed. Your Google-specific edits remain unchanged until reset."
      : "Shared content changed. Update this version from shared content when ready.");
  }
  return { blocking, warnings, saveable: blocking.length === 0, publishable: false };
}
