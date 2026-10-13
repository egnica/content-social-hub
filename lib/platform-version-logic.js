export function uniqueStringIds(values) {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  ];
}

export function isPublishableFacebookConnection(connection, clientId) {
  if (!connection || !clientId) return false;

  return (
    String(connection.clientId || "") === String(clientId) &&
    connection.platform === "facebook" &&
    connection.healthStatus === "healthy" &&
    connection.capabilities?.canPublish === true
  );
}

export function isPublishableInstagramConnection(connection, clientId) {
  if (!connection || !clientId) return false;

  return (
    String(connection.clientId || "") === String(clientId) &&
    connection.platform === "instagram" &&
    connection.healthStatus === "healthy" &&
    connection.capabilities?.canPublish === true
  );
}

export function isPublishableLinkedInConnection(connection, clientId) {
  return Boolean(connection && clientId && connection.platform === "linkedin" &&
    String(connection.clientId) === String(clientId) &&
    connection.providerAccountId && connection.healthStatus === "healthy" &&
    connection.capabilities?.canPublish === true);
}
export function isPublishableSocialConnection(connection, clientId) {
  if (connection?.platform === "facebook") {
    return isPublishableFacebookConnection(connection, clientId);
  }

  if (connection?.platform === "instagram") {
    return isPublishableInstagramConnection(connection, clientId);
  }
  if (connection?.platform === "linkedin") return isPublishableLinkedInConnection(connection, clientId);
  if (connection?.platform === "youtube") return Boolean(connection.providerAccountId && String(connection.clientId) === String(clientId) && connection.healthStatus === "healthy" && connection.capabilities?.canPublish === true);

  return false;
}

function inheritedMediaFields(content) {
  const mediaIds = uniqueStringIds(content?.mediaIds || []);
  const requestedPrimary = String(content?.defaultPrimaryMediaId || "").trim();
  const primaryMediaId = mediaIds.includes(requestedPrimary)
    ? requestedPrimary
    : mediaIds[0] || "";

  return { mediaIds, primaryMediaId };
}

export function buildInheritedFacebookFields(content) {
  const { mediaIds, primaryMediaId } = inheritedMediaFields(content);

  return {
    message: typeof content?.text === "string" ? content.text : "",
    destinationUrl:
      typeof content?.primaryUrl === "string" ? content.primaryUrl : "",
    mediaIds,
    primaryMediaId,
    videoThumbnailMediaId: String(
      content?.defaultVideoThumbnailMediaId || "",
    ).trim(),
    masterRevisionSynced: Number.isInteger(content?.revision)
      ? content.revision
      : 1,
    customized: false,
  };
}

export function buildInheritedInstagramFields(content) {
  const { mediaIds, primaryMediaId } = inheritedMediaFields(content);

  return {
    caption: typeof content?.text === "string" ? content.text : "",
    mediaIds,
    primaryMediaId,
    videoThumbnailMediaId: String(
      content?.defaultVideoThumbnailMediaId || "",
    ).trim(),
    masterRevisionSynced: Number.isInteger(content?.revision)
      ? content.revision
      : 1,
    customized: false,
  };
}

export function isFacebookVersionOutOfSync(version, masterRevision) {
  const syncedRevision = Number(version?.masterRevisionSynced || 0);
  const currentRevision = Number(masterRevision || 0);

  return syncedRevision !== currentRevision;
}

export function isInstagramVersionOutOfSync(version, masterRevision) {
  const syncedRevision = Number(version?.masterRevisionSynced || 0);
  const currentRevision = Number(masterRevision || 0);

  return syncedRevision !== currentRevision;
}

export function buildInheritedLinkedInFields(content) {
  const allowed = new Set((content?.mediaIds || []).map(String));
  const selected = (content?.media || []).filter((asset) =>
    allowed.has(String(asset._id)) && /^(image\/(jpeg|png|gif)|video\/mp4)$/.test(asset.contentType || ""));
  const mediaIds = selected[0]?.contentType?.startsWith("video/") ?
    [String(selected[0]._id)] : selected.filter((asset) => asset.contentType.startsWith("image/"))
      .slice(0, 20).map((asset) => String(asset._id));
  return {
    message: typeof content?.text === "string" ? content.text : "",
    destinationUrl: typeof content?.primaryUrl === "string" ? content.primaryUrl : "",
    mediaIds, primaryMediaId: mediaIds[0] || "",
    masterRevisionSynced: Number.isInteger(content?.revision) ? content.revision : 1,
    customized: false,
  };
}
export function isLinkedInVersionOutOfSync(version, revision) {
  return Number(version?.masterRevisionSynced || 0) !== Number(revision || 0);
}
export function normalizeLinkedInVersionDraft(input, media = []) {
  const ids = uniqueStringIds(input?.mediaIds);
  const byId = new Map(media.map((asset) => [String(asset._id), asset]));
  const selected = ids.map((id) => byId.get(id));
  const videos = selected.filter((asset) => asset?.contentType === "video/mp4");
  const images = selected.filter((asset) => /^(image\/jpeg|image\/png|image\/gif)$/.test(asset?.contentType || ""));
  if (ids.length > 20 || selected.some((asset) => !asset) || videos.length > 1 ||
      (videos.length && ids.length !== 1) || (!videos.length && images.length !== ids.length)) {
    throw new TypeError("Choose 1–20 JPEG, PNG or GIF images, or one MP4 video, not both.");
  }
  return { message: typeof input?.message === "string" ? input.message : "",
    destinationUrl: typeof input?.destinationUrl === "string" ? input.destinationUrl : "",
    mediaIds: ids, primaryMediaId: ids[0] || "" };
}
export function normalizeFacebookVersionDraft(input, allowedMediaIds = []) {
  const allowed = new Set(uniqueStringIds(allowedMediaIds));
  const mediaIds = uniqueStringIds(input?.mediaIds || []).filter((id) =>
    allowed.has(id),
  );
  const requestedPrimary = String(input?.primaryMediaId || "").trim();

  return {
    message: typeof input?.message === "string" ? input.message : "",
    destinationUrl:
      typeof input?.destinationUrl === "string" ? input.destinationUrl : "",
    mediaIds,
    primaryMediaId: mediaIds.includes(requestedPrimary)
      ? requestedPrimary
      : mediaIds[0] || "",
    videoThumbnailMediaId: String(input?.videoThumbnailMediaId || "").trim(),
  };
}

export function normalizeInstagramVersionDraft(input, allowedMediaIds = []) {
  const allowed = new Set(uniqueStringIds(allowedMediaIds));
  const mediaIds = uniqueStringIds(input?.mediaIds || []).filter((id) =>
    allowed.has(id),
  );
  const requestedPrimary = String(input?.primaryMediaId || "").trim();

  return {
    caption: typeof input?.caption === "string" ? input.caption : "",
    mediaIds,
    primaryMediaId: mediaIds.includes(requestedPrimary)
      ? requestedPrimary
      : mediaIds[0] || "",
  };
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

export function instagramMediaMode(media = [], mediaIds = []) {
  const selected = new Set(uniqueStringIds(mediaIds));
  const selectedMedia = media.filter((asset) =>
    selected.has(String(asset?._id || "")),
  );

  if (!selectedMedia.length || selectedMedia.length !== selected.size) {
    return "incompatible";
  }

  const supported = selectedMedia.every((asset) => {
    const type = String(asset?.contentType || "");
    return type.startsWith("image/") || type.startsWith("video/");
  });

  if (!supported) return "incompatible";

  if (selectedMedia.length === 1) {
    return String(selectedMedia[0]?.contentType || "").startsWith("video/")
      ? "reel"
      : "single_image";
  }

  return "carousel";
}

export function instagramMediaModeLabel(mode) {
  if (mode === "single_image") return "Single image";
  if (mode === "carousel") return "Carousel";
  if (mode === "reel") return "Reel / video";
  return "Incompatible";
}

export function validateFacebookVersionDraft({
  message = "",
  destinationUrl = "",
  mediaIds = [],
  healthStatus = "healthy",
  canPublish = true,
  masterChanged = false,
  customized = false,
} = {}) {
  const blocking = [];
  const warnings = [];
  const hasContent =
    Boolean(String(message).trim()) ||
    Boolean(String(destinationUrl).trim()) ||
    uniqueStringIds(mediaIds).length > 0;

  if (healthStatus !== "healthy" || canPublish !== true) {
    blocking.push(
      "The Facebook destination is not currently healthy and publishable.",
    );
  }

  if (!hasContent) {
    blocking.push("Add a message, destination URL, or media before publishing.");
  }

  if (destinationUrl && !validHttpUrl(destinationUrl)) {
    blocking.push("Use a valid http or https destination URL.");
  }

  if (masterChanged) {
    warnings.push(
      customized
        ? "Master content changed. Your Facebook-specific edits are preserved until you reset from Master."
        : "Master content changed. Update this Facebook version from Master before publishing.",
    );
  }

  return {
    blocking,
    warnings,
    publishable: blocking.length === 0,
  };
}

export function validateLinkedInVersionDraft({
  message = "", destinationUrl = "", mediaIds = [], media = [],
  healthStatus = "healthy", canPublish = true, masterChanged = false, customized = false,
} = {}) {
  const blocking = [], warnings = [];
  const ids = uniqueStringIds(mediaIds);
  if (healthStatus !== "healthy" || canPublish !== true)
    blocking.push("LinkedIn profile is not healthy and authorized.");
  if (!String(message).trim() && !String(destinationUrl).trim() && !ids.length)
    blocking.push("Add LinkedIn text, a link, or an image.");
  if (destinationUrl && !validHttpUrl(destinationUrl))
    blocking.push("Use a valid http or https link.");
  try { normalizeLinkedInVersionDraft({mediaIds: ids}, media); }
  catch (error) { blocking.push(error.message); }
  if (ids.length > 1 && destinationUrl)
    warnings.push("LinkedIn multi-image posts will display the link in post text.");
  if (masterChanged) warnings.push(customized ? "Master changed; LinkedIn edits preserved until reset." : "Master changed; update from Master.");
  return { blocking, warnings, publishable: blocking.length === 0 };
}
export function validateInstagramVersionDraft({
  caption = "",
  mediaIds = [],
  media = [],
  healthStatus = "healthy",
  canPublish = true,
  masterChanged = false,
  customized = false,
} = {}) {
  const blocking = [];
  const warnings = [];
  const mode = instagramMediaMode(media, mediaIds);

  if (healthStatus !== "healthy" || canPublish !== true) {
    blocking.push(
      "The Instagram destination is not currently healthy and publishable.",
    );
  }

  if (!uniqueStringIds(mediaIds).length) {
    blocking.push(
      "Instagram requires at least one compatible image or video. Text-only and URL-only content cannot be published to Instagram.",
    );
  } else if (mode === "incompatible") {
    blocking.push(
      "Every selected Instagram media item must be an attached image or video.",
    );
  }

  if (masterChanged) {
    warnings.push(
      customized
        ? "Master content changed. Your Instagram-specific edits are preserved until you reset from Master."
        : "Master content changed. Update this Instagram version from Master before publishing.",
    );
  }

  return {
    blocking,
    warnings,
    publishable: blocking.length === 0,
    mediaMode: mode,
  };
}

export function planPlatformVersionSelection({
  existingVersions = [],
  selectedConnectionIds = [],
}) {
  const selected = new Set(uniqueStringIds(selectedConnectionIds));
  const existingByConnection = new Map(
    existingVersions
      .filter((version) => version?.socialConnectionId)
      .map((version) => [String(version.socialConnectionId), version]),
  );

  const create = [];
  const reactivate = [];
  const keep = [];
  const exclude = [];

  for (const connectionId of selected) {
    const version = existingByConnection.get(connectionId);

    if (!version) {
      create.push(connectionId);
    } else if (version.active === false) {
      reactivate.push(connectionId);
    } else {
      keep.push(connectionId);
    }
  }

  for (const [connectionId, version] of existingByConnection) {
    if (version.active !== false && !selected.has(connectionId)) {
      exclude.push(connectionId);
    }
  }

  return { create, reactivate, keep, exclude };
}

export function buildInheritedYouTubeFields(content) {
  const available = (content?.media || []).filter((asset) =>
    (content?.mediaIds || []).map(String).includes(String(asset._id)) &&
    String(asset.contentType || "").startsWith("video/"));
  const chosen = available.find((asset) => String(asset._id) === String(content.defaultPrimaryMediaId)) || available[0];
  return {
    title: String(content?.internalTitle || "").slice(0, 100),
    description: String(content?.text || ""),
    privacyStatus: "private",
    madeForKids: null,
    mediaIds: chosen ? [String(chosen._id)] : [],
    primaryMediaId: chosen ? String(chosen._id) : "",
    videoThumbnailMediaId: String(content?.defaultVideoThumbnailMediaId || ""),
    chapters: "",
    masterRevisionSynced: Number.isInteger(content?.revision) ? content.revision : 1,
    customized: false,
  };
}
export function isYouTubeVersionOutOfSync(version, revision) {
  return Number(version?.masterRevisionSynced || 0) !== Number(revision || 0);
}
export function normalizeYouTubeVersionDraft(input) {
  const ids = uniqueStringIds(input?.mediaIds);
  return {
    title: String(input?.title || ""),
    description: String(input?.description || ""),
    privacyStatus: String(input?.privacyStatus || ""),
    madeForKids: typeof input?.madeForKids === "boolean" ? input.madeForKids : null,
    mediaIds: ids,
    primaryMediaId: ids[0] || "",
    videoThumbnailMediaId: String(input?.videoThumbnailMediaId || ""),
    chapters: String(input?.chapters || ""),
  };
}
export function validateYouTubeVersionDraft({
  title = "", description = "", privacyStatus = "", madeForKids = null,
  mediaIds = [], media = [], videoThumbnailMediaId = "", thumbnail = null,
  chapters = "", healthStatus = "healthy", canPublish = true,
  masterChanged = false, customized = false,
} = {}) {
  const blocking = [], warnings = [];
  if (healthStatus !== "healthy" || canPublish !== true)
    blocking.push("YouTube channel is not healthy and authorized.");
  if (!title.trim() || title.length > 100 || /[<>]/.test(title))
    blocking.push("Enter a YouTube title of 1–100 characters without angle brackets.");
  if (new TextEncoder().encode(description).length > 5000 || /[<>]/.test(description))
    blocking.push("YouTube description must be 5,000 UTF-8 bytes or fewer without angle brackets.");
  if (!["private", "unlisted", "public"].includes(privacyStatus))
    blocking.push("Choose Private, Unlisted, or Public visibility.");
  if (typeof madeForKids !== "boolean")
    blocking.push("Declare whether this video is Made for Kids.");
  const ids = uniqueStringIds(mediaIds);
  const selected = media.filter((asset) => ids.includes(String(asset._id)));
  if (ids.length !== 1 || selected.length !== 1 ||
      !String(selected[0]?.contentType || "").startsWith("video/"))
    blocking.push("Select exactly one Master-attached video.");
  if (videoThumbnailMediaId && (!thumbnail || String(thumbnail._id) !== videoThumbnailMediaId ||
      !["image/jpeg", "image/png"].includes(thumbnail.contentType)))
    blocking.push("Choose an uploaded JPEG or PNG thumbnail belonging to this client.");
  const rows = chapters.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (rows.length) {
    const seconds = [];
    for (const row of rows) {
      const match = row.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
      if (!match) { blocking.push("Each chapter needs a timestamp and a title."); break; }
      const segments = match[1].split(":").map(Number);
      if (segments.slice(1).some((n) => n >= 60)) { blocking.push("Chapter timestamps must use valid minutes and seconds."); break; }
      seconds.push(segments.reduce((sum, n) => sum * 60 + n, 0));
    }
    if (!blocking.some((x) => x.startsWith("Each chapter") || x.startsWith("Chapter timestamps"))) {
      if (seconds.length < 3 || seconds[0] !== 0 ||
          seconds.some((n, i) => i && n - seconds[i - 1] < 10))
        blocking.push("Chapters require at least three timestamps, starting at 00:00 and separated by 10 seconds.");
    }
  }
  if (masterChanged) warnings.push(customized
    ? "Master changed; YouTube edits are preserved until reset."
    : "Master changed; update from Master to inherit new defaults.");
  warnings.push("YouTube upload, processing, thumbnail submission and scheduling are not enabled in this editor task.");
  return { blocking, warnings, publishable: blocking.length === 0 };
}
