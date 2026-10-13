// Pure helpers. YouTube's thumbnail API acceptance and public thumbnail readback
// cannot prove that the selected local image is displayed on every Shorts surface.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PRIORITIES = ["maxres", "uhd", "qhd", "fhd", "standard", "high", "medium", "default"];

export function safeYouTubeThumbnailUrl(raw, videoId) {
  if (!VIDEO_ID.test(String(videoId || "")) || typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" ||
      !/^(i\d*\.ytimg\.com|img\.youtube\.com)$/.test(url.hostname) ||
      !url.pathname.split("/").includes(videoId)) return null;
    // Only expose a public thumbnail path, not provider-supplied query tokens.
    return url.origin + url.pathname;
  } catch { return null; }
}

export function youtubeThumbnailStatusLabel(attempt) {
  if (!attempt) return "Not checked";
  if (attempt.thumbnailStatus === "needs_review") return "Needs review";
  if (attempt.thumbnailStatus === "submitting") return "Submission started, result uncertain";
  if (attempt.thumbnailStatus === "submitted" || attempt.thumbnailStatus === "applied" ||
      attempt.thumbnailApplied === true) return "API accepted, visual verification required";
  if (attempt.videoThumbnailMediaAssetId) return "Not confirmed";
  return "No custom thumbnail selected";
}

export function summarizeYouTubeThumbnailReadback(data, { videoId, channelId, checkedAt = new Date() } = {}) {
  const checked = checkedAt instanceof Date ? checkedAt : new Date(checkedAt);
  const timestamp = Number.isFinite(checked.getTime()) ? checked.toISOString() : new Date().toISOString();
  const item = data?.items?.find(video => video.id === videoId);
  if (!item || !channelId || item.snippet?.channelId !== channelId) {
    return { checkedAt: timestamp, result: "unavailable", url: null,
      message: "YouTube did not return a video thumbnail for the authorized channel." };
  }
  for (const quality of PRIORITIES) {
    const url = safeYouTubeThumbnailUrl(item.snippet?.thumbnails?.[quality]?.url, videoId);
    if (url) return { checkedAt: timestamp, result: "reported", url, quality,
      message: "YouTube returned a thumbnail image. This does not prove it matches the selected custom file." };
  }
  return { checkedAt: timestamp, result: "not_reported", url: null,
    message: "YouTube returned the video but no usable thumbnail URL yet." };
}

export function unavailableYouTubeThumbnailReadback() {
  return { checkedAt: new Date().toISOString(), result: "unavailable", url: null,
    message: "Thumbnail lookup was unavailable. Check YouTube Studio before assuming it was applied." };
}
