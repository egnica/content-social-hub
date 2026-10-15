export const GOOGLE_BUSINESS_PLATFORM = "google_business_profile";
export const GOOGLE_BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";

export function normalizeGoogleBusinessScopes(value) {
  return [...new Set((Array.isArray(value) ? value : String(value || "").split(/\s+/))
    .filter(value => typeof value === "string" && value))];
}

export function assertGoogleBusinessResource(value, type) {
  if (typeof value !== "string" || !new RegExp(`^${type}/[A-Za-z0-9_-]+$`).test(value)) {
    throw new TypeError("Google returned an invalid business account or location identity.");
  }
  return value;
}

export function normalizeGoogleBusinessLocation(account, location) {
  const accountResourceName = assertGoogleBusinessResource(account.name, "accounts");
  const locationResourceName = assertGoogleBusinessResource(location.name, "locations");
  if (typeof location.title !== "string" || !location.title.trim()) {
    throw new TypeError("Google did not return the business location name.");
  }
  const address = location.storefrontAddress || {};
  return {
    providerAccountId: locationResourceName,
    accountResourceName,
    locationResourceName,
    providerParent: `${accountResourceName}/${locationResourceName}`,
    accountName: location.title.trim(),
    googleAccountName: typeof account.accountName === "string" ? account.accountName : accountResourceName,
    address: [...(Array.isArray(address.addressLines) ? address.addressLines.filter(x => typeof x === "string") : []),
      address.locality, address.administrativeArea, address.postalCode].filter(x => typeof x === "string" && x).join(", "),
  };
}

export function assertSameGoogleBusinessLocation(expectedId, actualId, expectedAccount, actualAccount) {
  if ((expectedId && expectedId !== actualId) || (expectedAccount && expectedAccount !== actualAccount)) {
    throw new TypeError("Choose the original business location and account. The existing connection was not replaced.");
  }
}

export function getGoogleBusinessHealth({ grantedScopes, tokenExpiresAt, hasRefreshToken, locationId, now = new Date() }) {
  const missingPermissions = normalizeGoogleBusinessScopes(grantedScopes).includes(GOOGLE_BUSINESS_SCOPE)
    ? [] : [GOOGLE_BUSINESS_SCOPE];
  let healthStatus = "healthy", healthMessage = "";
  const expiry = new Date(tokenExpiresAt || 0).getTime();
  if (!locationId || missingPermissions.length || !hasRefreshToken) {
    healthStatus = "permission_problem";
    healthMessage = !hasRefreshToken ? "Reconnect to grant renewable Google Business access."
      : "Reconnect to grant Business Profile permission and select a location.";
  } else if (!Number.isFinite(expiry) || expiry <= now.getTime()) {
    healthStatus = "expired";
    healthMessage = "Google access token expired. Check now renews it when possible.";
  } else if (expiry - now.getTime() <= 10 * 60 * 1000) {
    healthStatus = "expiring_soon";
    healthMessage = "Google access token expires soon; renewal is available.";
  }
  return { healthStatus, healthMessage, missingPermissions,
    canManageLocation: healthStatus === "healthy" || healthStatus === "expiring_soon",
    // Connection access is not evidence of post eligibility or an implemented publisher.
    canPublish: false };
}
