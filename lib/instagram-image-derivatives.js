import "server-only";

import sharp from "sharp";
import { getDb } from "@/lib/mongodb";
import {
  INSTAGRAM_JPEG_DERIVATIVE_VERSION,
  INSTAGRAM_MAX_IMAGE_BYTES,
  createInstagramJpegDerivativeKey,
  instagramJpegDerivativeName,
  isInstagramJpegSourceType,
  needsInstagramJpegDerivative,
} from "@/lib/instagram-image-derivative-logic";
import {
  readMediaObject,
  verifyMediaObject,
  writeMediaObject,
} from "@/lib/s3";

const JPEG_ATTEMPTS = [
  { quality: 90, maxDimension: null },
  { quality: 82, maxDimension: null },
  { quality: 86, maxDimension: 4096 },
  { quality: 82, maxDimension: 3200 },
  { quality: 78, maxDimension: 2560 },
  { quality: 74, maxDimension: 2048 },
  { quality: 70, maxDimension: 1600 },
];

function derivativeAsset(sourceAsset, derivative) {
  return {
    ...sourceAsset,
    objectKey: derivative.objectKey,
    originalName: derivative.originalName,
    contentType: derivative.contentType,
    size: derivative.size,
    width: derivative.width,
    height: derivative.height,
    aspectRatio: derivative.aspectRatio,
    instagramDerivative: true,
    sourceMediaAssetId: sourceAsset._id,
  };
}

async function reusableDerivative(sourceAsset) {
  const derivative = sourceAsset?.derivatives?.instagram?.jpeg;
  if (
    !derivative ||
    derivative.version !== INSTAGRAM_JPEG_DERIVATIVE_VERSION ||
    !derivative.objectKey ||
    derivative.sourceObjectKey !== sourceAsset.objectKey ||
    derivative.contentType !== "image/jpeg" ||
    Number(derivative.size || 0) <= 0 ||
    Number(derivative.size || 0) > INSTAGRAM_MAX_IMAGE_BYTES
  ) {
    return null;
  }

  try {
    await verifyMediaObject(derivative.objectKey);
    return derivative;
  } catch {
    return null;
  }
}

async function renderJpeg(sourceBytes) {
  const inputBuffer = Buffer.from(sourceBytes);
  let lastSize = 0;

  for (const attempt of JPEG_ATTEMPTS) {
    let pipeline = sharp(inputBuffer)
      .rotate()
      .flatten({ background: { r: 255, g: 255, b: 255 } });

    if (attempt.maxDimension) {
      pipeline = pipeline.resize({
        width: attempt.maxDimension,
        height: attempt.maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    const { data, info } = await pipeline
      .jpeg({ quality: attempt.quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    lastSize = data.byteLength;

    if (data.byteLength <= INSTAGRAM_MAX_IMAGE_BYTES) {
      const width = Number(info.width || 0);
      const height = Number(info.height || 0);

      if (!width || !height) {
        throw new Error(
          "The Instagram JPEG derivative was created without usable dimensions.",
        );
      }

      return {
        bytes: data,
        size: data.byteLength,
        width,
        height,
        aspectRatio: width / height,
        quality: attempt.quality,
        maxDimension: attempt.maxDimension,
      };
    }
  }

  throw new Error(
    `The Instagram JPEG derivative could not be reduced below 8 MB (last output ${lastSize} bytes).`,
  );
}

export async function ensureInstagramImageAsset(sourceAsset) {
  if (!sourceAsset?._id || !sourceAsset?.objectKey || !sourceAsset?.clientId) {
    throw new TypeError("A complete source media asset is required for Instagram.");
  }

  if (!isInstagramJpegSourceType(sourceAsset.contentType)) {
    throw new TypeError(
      "Instagram image publishing supports JPEG, PNG, WebP, and AVIF source images.",
    );
  }

  if (!needsInstagramJpegDerivative(sourceAsset)) {
    return { ...sourceAsset, instagramDerivative: false };
  }

  const existing = await reusableDerivative(sourceAsset);
  if (existing) return derivativeAsset(sourceAsset, existing);

  const source = await readMediaObject(sourceAsset.objectKey);
  const rendered = await renderJpeg(source.bytes);
  const objectKey = createInstagramJpegDerivativeKey({
    clientId: sourceAsset.clientId.toString(),
    mediaAssetId: sourceAsset._id.toString(),
  });

  await writeMediaObject({
    objectKey,
    bytes: rendered.bytes,
    contentType: "image/jpeg",
  });

  const now = new Date();
  const derivative = {
    version: INSTAGRAM_JPEG_DERIVATIVE_VERSION,
    sourceObjectKey: sourceAsset.objectKey,
    objectKey,
    originalName: instagramJpegDerivativeName(sourceAsset.originalName),
    contentType: "image/jpeg",
    size: rendered.size,
    width: rendered.width,
    height: rendered.height,
    aspectRatio: rendered.aspectRatio,
    quality: rendered.quality,
    maxDimension: rendered.maxDimension,
    createdAt: now,
    updatedAt: now,
  };

  const db = await getDb();
  await db.collection("media_assets").updateOne(
    {
      _id: sourceAsset._id,
      clientId: sourceAsset.clientId,
      objectKey: sourceAsset.objectKey,
      status: "uploaded",
    },
    {
      $set: {
        "derivatives.instagram.jpeg": derivative,
        updatedAt: now,
      },
    },
  );

  return derivativeAsset(sourceAsset, derivative);
}
