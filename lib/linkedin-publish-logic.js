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
  const assets=input.mediaAssets || [];
  const videos=assets.filter((asset)=>asset.contentType==="video/mp4");
  if(videos.length && (selected.length!==1 || assets.length!==1))
    blocking.push("Choose one MP4 video without images.");
  if(!videos.length && selected.length>20)
    blocking.push("LinkedIn supports no more than 20 images.");
  for(const asset of assets) {
    if (videos.length) {
      if (asset.contentType!=="video/mp4" || !Number.isFinite(Number(asset.size)) ||
          Number(asset.size)<1 || Number(asset.size)>500*1024*1024)
        blocking.push("LinkedIn MP4 videos must be no larger than 500 MB.");
    } else if (!["image/jpeg","image/png","image/gif"].includes(asset.contentType) ||
       !Number.isFinite(Number(asset.size)) || Number(asset.size)<1 ||
       Number(asset.size)>8*1024*1024)
      blocking.push("LinkedIn images must be JPEG, PNG, or GIF, up to 8 MB each.");
  }
  return {...base, blocking: [...new Set(blocking)], publishable: blocking.length === 0,
    publishMode: videos.length ? "video" : selected.length>1 ? "multi_image" : selected.length ? "image" : input.destinationUrl ? "link" : "text"};
}
export function validateLinkedInScheduledPublishDraft(input = {}) {
  // Scheduled posts use the same supported formats and validation as immediate
  // publishing. Live verification is tracked in the phase log, not a UI gate.
  return validateLinkedInPublishDraft(input);
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
