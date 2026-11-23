import { createHash } from "node:crypto";

export const BULK_DRAFT_BATCH_SIZE = 10;

export function bulkDraftFingerprint(clientId, post) {
  const destinations = post.destinations.map(({ account }) => account.id).sort();
  return createHash("sha256").update(JSON.stringify([
    clientId, post.post_key, post.title, post.master_text, post.link_url,
    post.media_url, post.local_date, post.local_time, post.releaseAt, destinations,
  ])).digest("hex");
}

export function validateBulkDraftAccounts(post, connections, clientId) {
  const byId = new Map(connections.map((connection) => [connection._id, connection]));
  const ids = [];
  for (const destination of post.destinations) {
    const selected = destination.account;
    const connection = byId.get(selected.id);
    if (!connection || connection.clientId !== clientId ||
        connection.platform !== selected.platform ||
        connection.accountName !== selected.name) {
      throw new TypeError("A selected account changed or belongs to another client. Download a fresh workbook.");
    }
    ids.push(connection._id);
  }
  return ids;
}

export function validateBulkDraftMedia(post, media) {
  const type = String(media?.contentType || "");
  for (const destination of post.destinations) {
    const platform = destination.account.platform;
    if (platform === "youtube" && !type.startsWith("video/")) {
      throw new TypeError("YouTube requires a video media URL.");
    }
    if (platform === "instagram" && !["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/quicktime"].includes(type)) {
      throw new TypeError("Instagram requires a supported image or MP4/MOV video.");
    }
    if (platform === "google_business_profile" &&
        (!type.startsWith("image/") || Number(media.width) < 250 || Number(media.height) < 250)) {
      throw new TypeError("Google Business requires an image at least 250 × 250 pixels.");
    }
  }
}
