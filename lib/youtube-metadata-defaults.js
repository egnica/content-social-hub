// Pure YouTube metadata defaults and upload-resource formatting.
// Channel-specific defaults may be supplied from social_connections.youtubeDefaults.
const FALLBACK = Object.freeze({
  paidPromotion: false,
  containsSyntheticMedia: false,
  defaultLanguage: "en",
  captionCertification: "never_aired_us",
  tags: [],
  recordingDate: "",
  recordingLocation: "",
});

const has = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

export function parseYouTubeTags(input) {
  const values = Array.isArray(input) ? input : String(input ?? "").split(",");
  const seen = new Set();
  return values.map((tag) => String(tag).trim()).filter((tag) => {
    if (!tag || seen.has(tag.toLocaleLowerCase("en"))) return false;
    seen.add(tag.toLocaleLowerCase("en"));
    return true;
  });
}

export function normalizeYouTubeMetadata(input = {}, defaults = FALLBACK) {
  const source = input || {};
  const base = defaults || FALLBACK;
  return {
    paidPromotion: has(source, "paidPromotion") ? source.paidPromotion : (base.paidPromotion ?? false),
    containsSyntheticMedia: has(source, "containsSyntheticMedia") ? source.containsSyntheticMedia : (base.containsSyntheticMedia ?? false),
    defaultLanguage: String(has(source, "defaultLanguage") ? source.defaultLanguage : (base.defaultLanguage ?? "en")).trim(),
    captionCertification: String(has(source, "captionCertification") ? source.captionCertification : (base.captionCertification ?? "never_aired_us")),
    tags: parseYouTubeTags(has(source, "tags") ? source.tags : (base.tags || [])),
    recordingDate: String(has(source, "recordingDate") ? source.recordingDate : (base.recordingDate || "")).trim(),
    recordingLocation: String(has(source, "recordingLocation") ? source.recordingLocation : (base.recordingLocation || "")).trim(),
  };
}

export function getYouTubeMetadataDefaults(channelDefaults = {}) {
  return normalizeYouTubeMetadata({}, { ...FALLBACK, ...channelDefaults });
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateYouTubeMetadata(input = {}) {
  const m = normalizeYouTubeMetadata(input);
  const errors = [];
  if (typeof m.paidPromotion !== "boolean") errors.push("Paid promotion must be Yes or No.");
  if (typeof m.containsSyntheticMedia !== "boolean") errors.push("Altered/synthetic content must be Yes or No.");
  if (!/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(m.defaultLanguage))
    errors.push("Select a supported metadata language code.");
  if (!["never_aired_us", "unspecified"].includes(m.captionCertification))
    errors.push("Select a valid caption certification setting.");
  if (m.tags.join(",").length > 500 || m.tags.some((tag) => tag.length > 100))
    errors.push("YouTube tags must total 500 characters or fewer, with no single tag over 100 characters.");
  if (m.recordingDate && !isValidDate(m.recordingDate))
    errors.push("Recording date must be a valid calendar date.");
  if (m.recordingLocation.length > 200)
    errors.push("Recording location cannot exceed 200 characters.");
  return errors;
}

export function buildYouTubeInsertMetadata({ title, description, privacyStatus, madeForKids, ...rest }) {
  const m = normalizeYouTubeMetadata(rest);
  const errors = validateYouTubeMetadata(m);
  if (errors.length) throw new TypeError(errors.join(" "));
  const snippet = { title, description, defaultLanguage: m.defaultLanguage };
  if (m.tags.length) snippet.tags = m.tags;
  const resource = {
    snippet,
    status: { privacyStatus, selfDeclaredMadeForKids: madeForKids, containsSyntheticMedia: m.containsSyntheticMedia },
  };
  const parts = ["snippet", "status"];
  if (m.recordingDate) {
    resource.recordingDetails = { recordingDate: `${m.recordingDate}T00:00:00.000Z` };
    parts.push("recordingDetails");
  }
  // Paid promotion, caption certification and free-text location are
  // retained in Content Social Hub, not sent as unsupported fields.
  return { parts, resource };
}
