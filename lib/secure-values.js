import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { requireEnv } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const encoded = requireEnv("OAUTH_TOKEN_ENCRYPTION_KEY");
  const key = Buffer.from(encoded, "base64");

  if (key.length !== 32) {
    throw new Error(
      "OAUTH_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte value.",
    );
  }

  return key;
}

export function createSecureToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashSecureToken(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function encryptSecret(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");

  if (
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    !encryptedValue
  ) {
    throw new Error("The encrypted value is invalid.");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
