import "server-only";

import sharp from "sharp";
import { getDb } from "@/lib/mongodb";
import { readMediaObject, verifyMediaObject, writeMediaObject } from "@/lib/s3";
import {
  JPEG_VARIANT_VERSION,
  eligibleGooglePhoto,
  jpegVariantKey,
  requiresGooglePhotoDerivative,
} from "@/lib/smart-media-logic";

const GOOGLE_MAX = 5 * 1024 * 1024;
const GOOGLE_MIN = 10 * 1024;
const FORMATS = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };

function usableDerivative(asset, variant) {
  return Boolean(
    variant &&
    variant.version === JPEG_VARIANT_VERSION &&
    variant.sourceObjectKey === asset.objectKey &&
    Number(variant.sourceSize) === Number(asset.size) &&
    variant.contentType === "image/jpeg" &&
    variant.size >= GOOGLE_MIN && variant.size <= GOOGLE_MAX &&
    variant.width >= 250 && variant.height >= 250 &&
    variant.objectKey === jpegVariantKey({
      clientId: String(asset.clientId), mediaAssetId: String(asset._id),
    })
  );
}

function asVariantAsset(asset, variant) {
  return {
    ...asset,
    objectKey: variant.objectKey,
    originalName: variant.originalName,
    contentType: variant.contentType,
    size: variant.size,
    width: variant.width,
    height: variant.height,
    aspectRatio: variant.width / variant.height,
    sourceMediaAssetId: asset._id,
    derivedFor: "google_business_profile",
  };
}

export async function ensureGoogleJpegAsset(asset) {
  if (!asset?._id || !asset?.clientId ||
      !asset?.objectKey?.startsWith("clients/" + asset.clientId + "/originals/") ||
      !eligibleGooglePhoto(asset)) {
    throw new TypeError("The Google photo source is invalid or too small.");
  }
  if (!requiresGooglePhotoDerivative(asset)) return asset;

  const saved = asset.derivatives?.shared?.googleJpeg;
  if (usableDerivative(asset, saved)) {
    try {
      await verifyMediaObject(saved.objectKey);
      return asVariantAsset(asset, saved);
    } catch {
      // A missing derivative may be recreated from the immutable original.
    }
  }

  const source = await readMediaObject(asset.objectKey);
  if (source.contentType !== asset.contentType ||
      source.contentLength !== Number(asset.size) ||
      source.bytes?.byteLength !== Number(asset.size)) {
    throw new TypeError("The source image bytes do not match the media record.");
  }
  const input = Buffer.from(source.bytes);
  const image = sharp(input, { limitInputPixels: 40_000_000, failOn: "error" });
  const meta = await image.metadata();
  if (FORMATS[meta.format] !== asset.contentType || Number(meta.pages || 1) !== 1) {
    throw new TypeError("The image format or frame count differs from the saved source.");
  }

  let rendered = null;
  for (const limit of [4096, 3200, 2560, 2048, 1600, 1200, 800]) {
    for (const quality of [90, 82, 74, 65]) {
      const { data, info } = await sharp(input, { limitInputPixels: 40_000_000 })
        .rotate().flatten({ background: "#ffffff" })
        .resize(limit, limit, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      if (info.width >= 250 && info.height >= 250 &&
          data.byteLength >= GOOGLE_MIN && data.byteLength <= GOOGLE_MAX) {
        rendered = { bytes: data, width: info.width, height: info.height, size: data.byteLength };
        break;
      }
    }
    if (rendered) break;
  }
  if (!rendered) throw new TypeError("This image cannot produce a Google-compatible JPEG.");

  const objectKey = jpegVariantKey({
    clientId: String(asset.clientId), mediaAssetId: String(asset._id),
  });
  await writeMediaObject({ objectKey, bytes: rendered.bytes, contentType: "image/jpeg" });

  const variant = {
    version: JPEG_VARIANT_VERSION, objectKey,
    sourceObjectKey: asset.objectKey, sourceSize: Number(asset.size),
    originalName: String(asset.originalName || "image").replace(/\.[^.]+$/, "") + "-google.jpg",
    contentType: "image/jpeg", size: rendered.size,
    width: rendered.width, height: rendered.height, updatedAt: new Date(),
  };
  const db = await getDb();
  const result = await db.collection("media_assets").updateOne(
    {
      _id: asset._id, clientId: asset.clientId, objectKey: asset.objectKey,
      size: asset.size, status: "uploaded",
    },
    { $set: { "derivatives.shared.googleJpeg": variant, updatedAt: new Date() } },
  );
  if (!result.matchedCount) {
    throw new TypeError("The photo changed before Google conversion completed.");
  }
  return asVariantAsset(asset, variant);
}
