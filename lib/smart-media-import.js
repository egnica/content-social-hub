import "server-only";

import http from "node:http";
import https from "node:https";
import sharp from "sharp";
import { fetchLinkPreviewMetadata, resolvePublicHttpUrl } from "@/lib/link-preview";
import { createObjectKey, writeMediaObject } from "@/lib/s3";
import {
  AUTO_IMAGE_SOURCE, IMAGE_SOURCE_TYPES, MAX_ORIGINAL_IMAGE_BYTES, selectMasterMedia,
} from "@/lib/smart-media-logic";

const TIMEOUT_MS = 8_000;
const REDIRECT_LIMIT = 3;
const EXTENSIONS = {
  "image/jpeg": "jpg", "image/png": "png",
  "image/webp": "webp", "image/avif": "avif",
};

function requestPinned(url, address, family) {
  return new Promise((resolve, reject) => {
    const scheme = new URL(url).protocol;
    const transport = scheme === "https:" ? https : http;
    const req = transport.request(url, {
      method: "GET",
      timeout: TIMEOUT_MS,
      lookup: (_hostname, options, callback) => {
        // Node's auto-family-selection may request an array of addresses.
        // Return only the previously validated address to preserve DNS pinning.
        if (options?.all) callback(null, [{ address, family }]);
        else callback(null, address, family);
      },
      headers: {
        Accept: "image/jpeg,image/png,image/webp,image/avif;q=0.8",
        "User-Agent": "ContentSocialHub/1.0",
      },
    }, (response) => {
      const status = Number(response.statusCode);
      if (status >= 300 && status < 400) {
        const redirect = response.headers.location;
        response.resume();
        resolve({ redirect });
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new TypeError("The link image server did not return a usable image."));
        return;
      }
      const type = String(response.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      const announced = Number(response.headers["content-length"] || 0);
      if (!IMAGE_SOURCE_TYPES.has(type) ||
          (announced && (!Number.isFinite(announced) || announced > MAX_ORIGINAL_IMAGE_BYTES))) {
        response.resume();
        reject(new TypeError("The link image format or size is unsupported."));
        return;
      }
      const chunks = [];
      let total = 0;
      response.on("data", (chunk) => {
        total += chunk.byteLength;
        if (total > MAX_ORIGINAL_IMAGE_BYTES) {
          response.destroy(new TypeError("The linked image exceeds the media size limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({ type, bytes: Buffer.concat(chunks) }));
      response.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new TypeError("Linked image retrieval timed out.")));
    req.on("error", reject);
    req.end();
  });
}

async function retrievePublicImage(imageUrl) {
  let currentUrl = imageUrl;
  for (let redirects = 0; redirects <= REDIRECT_LIMIT; redirects += 1) {
    // Validate every redirect and pin requests to the DNS address that passed validation.
    const { url, address, family } = await resolvePublicHttpUrl(currentUrl);
    const result = await requestPinned(url, address, family);
    if (!result.redirect) return result;
    if (redirects === REDIRECT_LIMIT) {
      throw new TypeError("The link image redirected too many times.");
    }
    currentUrl = new URL(result.redirect, url).toString();
  }
  throw new TypeError("Unable to retrieve link image.");
}

async function importOpenGraphImage({ primaryUrl, clientId, mediaCollection }) {
  const preview = await fetchLinkPreviewMetadata(primaryUrl);
  if (!preview.imageUrl) return null;
  const remote = await retrievePublicImage(preview.imageUrl);
  const metadata = await sharp(remote.bytes, {
    limitInputPixels: 40_000_000, failOn: "error",
  }).metadata();
  const expectedType = "image/" + (metadata.format === "jpeg" ? "jpeg" : metadata.format);
  if (expectedType !== remote.type || Number(metadata.pages || 1) !== 1 ||
      !(metadata.width > 0) || !(metadata.height > 0)) {
    throw new TypeError("The linked image was not a supported, single-frame image.");
  }

  const objectKey = createObjectKey(
    String(clientId), "link-preview." + EXTENSIONS[remote.type],
  );
  await writeMediaObject({
    objectKey, bytes: remote.bytes, contentType: remote.type,
  });
  const now = new Date();
  const asset = {
    clientId, objectKey, originalName: "link-preview." + EXTENSIONS[remote.type],
    contentType: remote.type, size: remote.bytes.byteLength,
    width: metadata.width, height: metadata.height,
    aspectRatio: metadata.width / metadata.height,
    orientation: metadata.width === metadata.height ? "square" :
      metadata.width > metadata.height ? "landscape" : "portrait",
    duration: null, status: "uploaded",
    sourceType: AUTO_IMAGE_SOURCE,
    sourcePageUrl: primaryUrl,
    sourceImageUrl: preview.imageUrl,
    createdAt: now, updatedAt: now,
  };
  const result = await mediaCollection.insertOne(asset);
  return { ...asset, _id: result.insertedId };
}

/**
 * Called during Master Content persistence after normal client and media validation.
 * Link image is imported only when no manually uploaded media is attached.
 * Existing matching link images are reused; manual images and videos take priority.
 */
export async function reconcileSmartMasterMedia({
  normalized, validMedia, clientId, mediaCollection,
}) {
  const byId = new Map(validMedia.map((asset) => [String(asset._id), asset]));
  const ordered = normalized.mediaIds.map((id) => byId.get(String(id))).filter(Boolean);
  const decision = selectMasterMedia({ media: ordered, linkUrl: normalized.primaryUrl });

  let finalMedia = decision.media;
  let warning = "";
  if (decision.importLink) {
    try {
      const imported = await importOpenGraphImage({
        primaryUrl: normalized.primaryUrl, clientId, mediaCollection,
      });
      finalMedia = imported ? [imported] : [];
      if (!imported) {
        warning = "The linked page did not provide a usable image. You can upload one manually.";
      }
    } catch {
      // Keep valid text/link content, but do not misrepresent the import as a success.
      // Never expose remote URLs, S3 keys, or provider errors to the browser.
      finalMedia = [];
      warning = "The website image could not be imported. Try saving again or upload an image manually.";
    }
  }

  normalized.mediaIds = finalMedia.map((asset) => asset._id);
  const validPrimary = finalMedia.some((asset) =>
    String(asset._id) === String(normalized.defaultPrimaryMediaId)
  );
  if (!validPrimary) normalized.defaultPrimaryMediaId = finalMedia[0]?._id || null;
  return { warning };
}
