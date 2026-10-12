export const LINKEDIN_PLATFORM = "linkedin";
export const LINKEDIN_REQUIRED_SCOPES = ["openid", "profile", "w_member_social"];
const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeLinkedInScopes(scopes) {
  const values = Array.isArray(scopes) ? scopes : String(scopes || "").split(/[ ,]+/);
  return [...new Set(values.map((scope) => String(scope).trim()).filter(Boolean))];
}

export function getLinkedInHealth({ grantedScopes, tokenExpiresAt, now = new Date() }) {
  const granted = new Set(normalizeLinkedInScopes(grantedScopes));
  const missingPermissions = LINKEDIN_REQUIRED_SCOPES.filter((scope) => !granted.has(scope));
  const expiresAt = tokenExpiresAt ? new Date(tokenExpiresAt) : null;
  if (!expiresAt || !Number.isFinite(expiresAt.getTime())) {
    return {
      healthStatus: "permission_problem",
      healthMessage: "LinkedIn token expiration could not be verified. Reconnect this profile.",
      missingPermissions,
      canPublish: false,
    };
  }
  if (expiresAt <= now) {
    return {
      healthStatus: "expired",
      healthMessage: "LinkedIn authorization expired. Reconnect this profile.",
      missingPermissions,
      canPublish: false,
    };
  }
  if (missingPermissions.length) {
    return {
      healthStatus: "permission_problem",
      healthMessage: `Missing: ${missingPermissions.join(", ")}. Reconnect this profile.`,
      missingPermissions,
      canPublish: false,
    };
  }
  if (expiresAt.getTime() - now.getTime() <= EXPIRING_SOON_MS) {
    return {
      healthStatus: "expiring_soon",
      healthMessage: "LinkedIn authorization expires soon. Reconnect before the scheduled post.",
      missingPermissions: [],
      canPublish: true,
    };
  }
  return { healthStatus: "healthy", healthMessage: "", missingPermissions: [], canPublish: true };
}

export function linkedinProfileIdentity(profile) {
  const id = typeof profile?.sub === "string" ? profile.sub.trim() : "";
  if (!id) throw new TypeError("LinkedIn did not return a verified member identity.");
  const name = [profile?.given_name, profile?.family_name].filter(Boolean).join(" ").trim();
  return {
    providerAccountId: id,
    accountName: name || String(profile?.name || "LinkedIn member"),
    pictureUrl: /^https:\/\//i.test(profile?.picture || "") ? profile.picture : "",
  };
}
