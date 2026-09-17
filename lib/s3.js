import "server-only";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { getAwsRegion, requireEnv } from "@/lib/env";

const s3 = new S3Client({
  region: getAwsRegion(),
  maxAttempts: 3,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

function getBucket() {
  return requireEnv("S3_MEDIA_BUCKET");
}

function safeFilename(filename) {
  const parts = String(filename || "upload")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(-140);

  return parts || "upload";
}

export function validateMediaUpload({ contentType, size }) {
  const isImage = contentType?.startsWith("image/");
  const isVideo = contentType?.startsWith("video/");

  if (!isImage && !isVideo) {
    return "Only image and video files are supported.";
  }

  const limit = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;

  if (!Number.isFinite(size) || size <= 0 || size > limit) {
    return isImage
      ? "Images must be 25 MB or smaller."
      : "Videos must be 2 GB or smaller.";
  }

  return null;
}

export function createObjectKey(clientId, filename) {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return [
    "clients",
    clientId,
    "originals",
    String(now.getUTCFullYear()),
    month,
    `${randomUUID()}-${safeFilename(filename)}`,
  ].join("/");
}

export async function createUploadUrl({ objectKey, contentType }) {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: objectKey,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
  });

  return getSignedUrl(s3, command, { expiresIn: 10 * 60 });
}

export async function createMediaViewUrl(objectKey) {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: objectKey,
  });

  return getSignedUrl(s3, command, { expiresIn: 60 * 60 });
}

export async function verifyMediaObject(objectKey) {
  await s3.send(
    new HeadObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
    }),
  );
}
