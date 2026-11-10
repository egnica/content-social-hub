export { googleBusinessParent } from "./google-business-post-logic.js";
import { validateGoogleBusinessDraft } from "./google-business-post-logic.js";

export function validateGoogleBusinessPublish(version, master, selectedMedia = []) {
  const validation = validateGoogleBusinessDraft(version, selectedMedia);
  if (!version.customized && Number(version.masterRevisionSynced) !== Number(master.revision)) {
    validation.blocking.push("Shared content changed. Update this Google version before publishing.");
  }
  return { ...validation, publishable: validation.blocking.length === 0 };
}

export function googleBusinessPostPayload(version, imageSourceUrl = "") {
  const payload = { languageCode: "en-US", topicType: "STANDARD", summary: version.summary };
  if (version.ctaType) payload.callToAction = {
    actionType: version.ctaType,
    ...(version.ctaType === "CALL" ? {} : { url: version.ctaUrl }),
  };
  if ((version.mediaIds || []).length) {
    const url = new URL(imageSourceUrl);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password ||
        version.mediaIds.length !== 1) {
      throw new TypeError("A single verified HTTPS Google photo source is required.");
    }
    payload.media = [{ mediaFormat: "PHOTO", sourceUrl: imageSourceUrl }];
  } else if (imageSourceUrl) {
    throw new TypeError("Do not attach a photo source to a text-only Google post.");
  }
  return payload;
}

// Only provider-returned exact post links are used. Never construct a Maps fallback.
export function googleBusinessPostResult(data, parent, expectedName = "") {
  const name = String(data?.name || "");
  if (!name.startsWith(`${parent}/localPosts/`) ||
      !/^[A-Za-z0-9_-]+$/.test(name.slice(`${parent}/localPosts/`.length)) ||
      (expectedName && name !== expectedName)) {
    throw new TypeError("Google returned an unverified post identity. Review the recorded attempt before publishing again.");
  }
  let providerPostUrl = "";
  try {
    const url = new URL(data?.searchUrl);
    if (url.protocol === "https:" && !url.username && !url.password &&
        (url.hostname === "google.com" || url.hostname.endsWith(".google.com") || url.hostname === "local.google.com")) {
      providerPostUrl = url.href;
    }
  } catch { /* A missing link is retained as missing and can be refreshed. */ }
  const providerState = ["LIVE", "PROCESSING", "REJECTED"].includes(data?.state) ? data.state : "UNSPECIFIED";
  const status = providerState === "LIVE" ? "succeeded" : providerState === "REJECTED" ? "rejected" : "processing";
  return { providerPostId: name, providerPostUrl, providerState, status };
}
