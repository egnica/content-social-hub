import "server-only";

import { decryptSecret } from "@/lib/secure-values";

export function openStoredFacebookPublishingCredential(encryptedValue) {
  return decryptSecret(encryptedValue);
}
