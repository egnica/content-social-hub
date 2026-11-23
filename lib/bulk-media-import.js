import "server-only";

import http from "node:http";
import https from "node:https";
import sharp from "sharp";
import { resolvePublicHttpUrl } from "@/lib/link-preview";
import { createObjectKey, writeMediaObject } from "@/lib/s3";
import { completeMediaUpload, createPendingMedia } from "@/lib/data";

const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"],
  ["image/webp", "webp"], ["image/avif", "avif"],
]);
const VIDEO_TYPES = new Map([
  ["video/mp4", "mp4"], ["video/quicktime", "mov"], ["video/webm", "webm"],
]);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;

function pinnedDownload(url, address, family) {
  return new Promise((resolve, reject) => {
    const transport = new URL(url).protocol === "https:" ? https : http;
    const request = transport.request(url, {
      method: "GET",
      timeout: TIMEOUT_MS,
      lookup: (_hostname, options, callback) => {
        if (options?.all) callback(null, [{ address, family }]);
        else callback(null, address, family);
      },
      headers: { Accept: "image/*,video/mp4,video/quicktime,video/webm", "User-Agent": "ContentSocialHub/1.0" },
    }, (response) => {
      const status = Number(response.statusCode);
      if (status >= 300 && status < 400) {
        const location = response.headers.location;
        response.resume();
        if (!location) reject(new TypeError("The media URL redirected without a destination."));
        else resolve({ redirect: new URL(location, url).toString() });
        return;
      }
      if (status !== 200) {
        response.resume();
        reject(new TypeError("The media URL did not return an accessible file."));
        return;
      }
      const contentType = String(response.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      const limit = IMAGE_TYPES.has(contentType) ? MAX_IMAGE_BYTES :
        VIDEO_TYPES.has(contentType) ? MAX_VIDEO_BYTES : 0;
      const length = Number(response.headers["content-length"] || 0);
      if (!limit || !Number.isFinite(length) || length > limit) {
        response.resume();
        reject(new TypeError("The media file is unsupported or exceeds the bulk import limit."));
        return;
      }
      const chunks = [];
      let total = 0;
      let complete = false;
      response.on("data", (chunk) => {
        total += chunk.length;
        if (total > limit) {
          response.destroy(new TypeError("The media file exceeds the bulk import limit."));
        } else {
          chunks.push(chunk);
        }
      });
      response.on("end", () => {
        complete = true;
        resolve({ bytes: Buffer.concat(chunks), contentType });
      });
      response.on("aborted", () => reject(new TypeError("The remote media transfer was interrupted.")));
      response.on("close", () => {
        if (!complete) reject(new TypeError("The remote media transfer ended early."));
      });
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new TypeError("The media URL timed out.")));
    request.on("error", reject);
    request.end();
  });
}

export async function downloadBulkMedia(url) {
  let current = url;
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    // Verify and pin the public DNS answer on *every* redirect, preventing SSRF and DNS rebinding.
    const resolved = await resolvePublicHttpUrl(current);
    const response = await pinnedDownload(resolved.url, resolved.address, resolved.family);
    if (!response.redirect) {
      const { bytes, contentType } = response;
      if (!bytes.length) throw new TypeError("The media URL returned an empty file.");
      if (IMAGE_TYPES.has(contentType)) {
        const metadata = await sharp(bytes, {
          limitInputPixels: 40_000_000, failOn: "error",
        }).metadata();
        const actualType = "image/" + (metadata.format === "jpeg" ? "jpeg" : metadata.format);
        if (actualType !== contentType || Number(metadata.pages || 1) !== 1 ||
            !(metadata.width > 0) || !(metadata.height > 0)) {
          throw new TypeError("The media URL did not contain a supported single-frame image.");
        }
        return {
          bytes, contentType, extension: IMAGE_TYPES.get(contentType),
          width: metadata.width, height: metadata.height,
          duration: null,
        };
      }
      const validVideo = contentType === "video/webm" ?
        bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) :
        bytes.length > 12 && bytes.toString("ascii", 4, 8) === "ftyp";
      if (!validVideo) throw new TypeError("The media URL did not contain a valid video file.");
      return {
        bytes, contentType, extension: VIDEO_TYPES.get(contentType),
        width: null, height: null, duration: null,
      };
    }
    if (attempt === MAX_REDIRECTS) throw new TypeError("The media URL redirected too many times.");
    current = response.redirect;
  }
  throw new TypeError("The media URL could not be loaded.");
}

export async function saveBulkMedia(clientId, downloaded) {
  const originalName = "bulk-import." + downloaded.extension;
  const objectKey = createObjectKey(clientId, originalName);
  const asset = await createPendingMedia({
    clientId, objectKey, originalName,
    contentType: downloaded.contentType,
    size: downloaded.bytes.length,
    width: downloaded.width, height: downloaded.height,
    duration: downloaded.duration,
    aspectRatio: downloaded.width && downloaded.height ? downloaded.width / downloaded.height : null,
    orientation: downloaded.width && downloaded.height ?
      downloaded.width === downloaded.height ? "square" :
        downloaded.width > downloaded.height ? "landscape" : "portrait" : null,
  });
  await writeMediaObject({
    objectKey, bytes: downloaded.bytes, contentType: downloaded.contentType,
  });
  const uploaded = await completeMediaUpload(asset._id);
  if (!uploaded) throw new TypeError("The imported media was not finalized.");
  return uploaded;
}
