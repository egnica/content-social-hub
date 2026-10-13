import { validateLinkedInVersionDraft } from "./platform-version-logic.js";

export function linkedInPostText({ message = "", destinationUrl = "" } = {}) {
  const text = String(message || "").trim();
  const url = String(destinationUrl || "").trim();
  return url && text && !text.includes(url) ? text + "\n\n" + url : text || url;
}
export function linkedinSubmissionKey(id, revision) {
  if (!id || !Number.isInteger(Number(revision)) || Number(revision) < 1) throw new TypeError("A saved LinkedIn revision is required.");
  return `linkedin:${id}:revision:${revision}`;
}
export function linkedinPostUrl(urn) {
  const match = String(urn || "").match(/^urn:li:(?:share|ugcPost):(\d+)$/);
  return match ? `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}/` : "";
}
export function validateLinkedInPublishDraft(input = {}) {
  const selected = (input.mediaIds || []).map(String);
  const base = validateLinkedInVersionDraft({
    ...input, media: input.mediaAssets || [], healthStatus: input.healthStatus,
    canPublish: input.canPublish,
  });
  const blocking = [...base.blocking];
  if (selected.length && (input.mediaAssets || []).length !== selected.length) blocking.push("The selected image is unavailable.");
  const asset = (input.mediaAssets || [])[0];
  if (asset && (!["image/jpeg", "image/png", "image/gif"].includes(asset.contentType) ||
      !Number.isFinite(Number(asset.size)) || Number(asset.size) < 1 ||
      Number(asset.size) > 8 * 1024 * 1024))
    blocking.push("LinkedIn images must be JPEG, PNG, or GIF, up to 8 MB.");
  return {...base, blocking: [...new Set(blocking)], publishable: blocking.length === 0,
    publishMode: selected.length ? "image" : input.destinationUrl ? "link" : "text"};
}
export function linkedinErrorDetails(error) {
  const status = Number(error?.status || error?.details?.status || 0);
  return {name:"LinkedInPublishError", message:"LinkedIn could not publish this post.", status: status || null};
}
// A response before the final create-post request is safe to retry if the
// provider definitively rejected it. Once create-post begins, lock uncertainty.
export function isLinkedInDefinitiveFailure(error) {
  return error?.name === "LinkedInPublishApiError" && [400,401,403,404,422].includes(Number(error.status));
}
