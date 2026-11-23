import "server-only";

import { createContent, getImportedBulkContent } from "@/lib/data";
import { downloadBulkMedia, saveBulkMedia } from "@/lib/bulk-media-import";
import {
  bulkDraftFingerprint, validateBulkDraftAccounts, validateBulkDraftMedia,
} from "@/lib/bulk-draft-logic";
import { isEditableGoogleBusinessConnection } from "@/lib/google-business-post-logic";
import { isPublishableSocialConnection } from "@/lib/platform-version-logic";
import { syncPlatformVersionSelection } from "@/lib/platform-versions";
import { hasValidationErrors, validateContentInput } from "@/lib/validation";

function eligibleDestination(connection, clientId) {
  return isPublishableSocialConnection(connection, clientId) ||
    isEditableGoogleBusinessConnection(connection, clientId);
}

function assertDraftRequirements(post) {
  for (const { account } of post.destinations) {
    const length = [...post.master_text].length;
    if (account.platform === "google_business_profile" && length > 1500) {
      throw new TypeError("Google Business summaries must be 1,500 characters or fewer.");
    }
    if (account.platform === "instagram" && length > 2200) {
      throw new TypeError("Instagram captions must be 2,200 characters or fewer.");
    }
    if (account.platform === "linkedin" && length > 3000) {
      throw new TypeError("LinkedIn posts must be 3,000 characters or fewer.");
    }
    if (account.platform === "youtube" &&
        (post.title.length > 100 || /[<>]/.test(post.title) ||
         new TextEncoder().encode(post.master_text).length > 5000 ||
         /[<>]/.test(post.master_text))) {
      throw new TypeError("YouTube titles must be 100 characters or fewer and descriptions at most 5,000 bytes, without angle brackets.");
    }
  }
}

export async function importBulkDraftRow(post, clientId, connections) {
  const accountIds = validateBulkDraftAccounts(post, connections, clientId);
  for (const id of accountIds) {
    const connection = connections.find((item) => item._id === id);
    if (!eligibleDestination(connection, clientId)) {
      throw new TypeError("A selected destination is not healthy or available for draft creation.");
    }
  }
  assertDraftRequirements(post);
  const fingerprint = bulkDraftFingerprint(clientId, post);
  const imported = await getImportedBulkContent(clientId, post.post_key);
  if (imported && imported.bulkImport?.fingerprint !== fingerprint) {
    throw new TypeError("This post_key was already used for different content. Choose a new key.");
  }

  let content = imported;
  let warning = "";
  if (!content) {
    let mediaIds = [];
    let primaryMediaId = "";
    if (post.media_url) {
      // Download before any Master write. Media may be saved in private storage,
      // but a remote file cannot directly become a public provider media URL.
      const downloaded = await downloadBulkMedia(post.media_url);
      validateBulkDraftMedia(post, downloaded);
      const media = await saveBulkMedia(clientId, downloaded);
      mediaIds = [media._id];
      primaryMediaId = media._id;
      if (downloaded.contentType.startsWith("video/")) {
        warning = "Video duration and dimensions were not extracted from the remote file. Review them before publishing.";
      }
    }

    const { data, errors } = validateContentInput({
      clientId,
      internalTitle: post.title,
      text: post.master_text,
      primaryUrl: post.link_url,
      mediaIds,
      defaultPrimaryMediaId: primaryMediaId,
      defaultReleaseAt: post.local_date + "T" + post.local_time,
      contentLength: "short",
      reusable: false,
    });
    if (hasValidationErrors(errors)) throw new TypeError("The Master Content fields failed validation.");
    content = await createContent(data, {
      bulkImport: { key: post.post_key, fingerprint },
    });
    if (content.mediaImportWarning) {
      warning = [warning, content.mediaImportWarning].filter(Boolean).join(" ");
    }
  }

  // This existing operation is idempotent per (Master, connection) and can
  // resume safely after a successful Master insert and failed version write.
  await syncPlatformVersionSelection(content._id, accountIds);
  return {
    row: post.row, post_key: post.post_key, status: imported || content.bulkImportReused ? "existing" : "created",
    contentId: content._id, title: post.title, destinations: accountIds.length,
    warning,
  };
}
