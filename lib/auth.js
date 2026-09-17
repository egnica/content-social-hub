import "server-only";

import { timingSafeEqual } from "node:crypto";
import { requireEnv } from "@/lib/env";

export function isValidAdminPassword(candidate) {
  const expected = Buffer.from(requireEnv("ADMIN_PASSWORD"));
  const provided = Buffer.from(String(candidate || ""));

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}
