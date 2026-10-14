import "server-only";

import { getDb } from "@/lib/mongodb";
import { toObjectId } from "@/lib/ids";
import { decryptSecret } from "@/lib/secure-values";
import { checkFacebookPage } from "@/lib/facebook";
import { getInstagramProfile } from "@/lib/instagram";

const avatars = new Map();
const CACHE_MS = 5 * 60 * 1000;

function safeMetaPictureUrl(value) {
  try {
    const url = new URL(value);
    const allowed = ["fbcdn.net", "cdninstagram.com", "fbsbx.com"].some(
      host => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
    if (!allowed || url.protocol !== "https:" || url.username || url.password ||
        url.port || [...url.searchParams.keys()].some(key => /token|secret|authorization/i.test(key))) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export async function getSocialAccountAvatarUrl(id, clientId) {
  const connectionId = toObjectId(id), ownerId = toObjectId(clientId);
  if (!connectionId || !ownerId) return null;
  const db = await getDb();
  const connection = await db.collection("social_connections").findOne({
    _id: connectionId, clientId: ownerId, platform: { $in: ["facebook", "instagram"] },
  });
  if (!connection?.tokenEncrypted || !connection.providerAccountId ||
      connection.healthStatus === "disconnected") return null;

  // Read the current client/account before consulting the bounded cache. A
  // reconnect or health check changes updatedAt and invalidates its photo.
  const key = `${connection._id}:${connection.clientId}:${connection.platform}:${connection.providerAccountId}:${connection.updatedAt || ""}`;
  const now = Date.now();
  for (const [cachedKey, cached] of avatars) {
    if (cached.expiresAt <= now) avatars.delete(cachedKey);
  }
  if (avatars.has(key)) return avatars.get(key).promise;
  if (avatars.size >= 100) avatars.delete(avatars.keys().next().value);

  const promise = (async () => {
    const token = decryptSecret(connection.tokenEncrypted);
    const profile = connection.platform === "facebook"
      ? await checkFacebookPage(connection.providerAccountId, token, { signal: AbortSignal.timeout(10000) })
      : await getInstagramProfile(token);
    if (String(profile.providerAccountId) !== String(connection.providerAccountId))
      throw new Error("Account photo identity does not match the saved connection.");
    return safeMetaPictureUrl(profile.pictureUrl);
  })();
  const entry = { promise, expiresAt: now + CACHE_MS };
  avatars.set(key, entry);
  try {
    return await promise;
  } catch (error) {
    // Briefly suppress repeated failed lookups from the chip and detail avatar.
    // Credential/health state is not changed by this optional display request.
    entry.promise = Promise.resolve(null);
    entry.expiresAt = Date.now() + 30000;
    throw error;
  }
}
