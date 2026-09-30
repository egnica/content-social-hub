export const INSTAGRAM_PLATFORM = "instagram";

export const INSTAGRAM_REQUIRED_PERMISSIONS = [
  "instagram_business_basic",
  "instagram_business_content_publish",
];

const PROFESSIONAL_ACCOUNT_TYPES = new Set([
  "BUSINESS",
  "CREATOR",
  "MEDIA_CREATOR",
]);

const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeInstagramPermissions(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))];
  }

  if (typeof value === "string") {
    return [
      ...new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }

  return [];
}

export function buildInstagramConnectionIdentity(clientId, providerAccountId) {
  if (!clientId || !providerAccountId) {
    throw new TypeError("Instagram connection identity requires client and account IDs.");
  }

  return {
    clientId,
    platform: INSTAGRAM_PLATFORM,
    providerAccountId: String(providerAccountId),
  };
}

export function getInstagramHealth({
  grantedScopes,
  accountType,
  tokenExpiresAt = null,
  now = new Date(),
}) {
  const granted = new Set(normalizeInstagramPermissions(grantedScopes));
  const missingPermissions = INSTAGRAM_REQUIRED_PERMISSIONS.filter(
    (permission) => !granted.has(permission),
  );
  const normalizedAccountType = String(accountType || "").toUpperCase();
  const isProfessional = PROFESSIONAL_ACCOUNT_TYPES.has(normalizedAccountType);
  const expiresAt = tokenExpiresAt ? new Date(tokenExpiresAt) : null;

  if (expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt <= now) {
    return {
      healthStatus: "expired",
      healthMessage: "Instagram authorization has expired. Reconnect this account.",
      missingPermissions,
      canPublish: false,
    };
  }

  if (!isProfessional) {
    return {
      healthStatus: "permission_problem",
      healthMessage:
        "Instagram publishing requires a Professional account (Business or Creator).",
      missingPermissions,
      canPublish: false,
    };
  }

  if (missingPermissions.length) {
    return {
      healthStatus: "permission_problem",
      healthMessage: `Missing: ${missingPermissions.join(", ")}`,
      missingPermissions,
      canPublish: false,
    };
  }

  if (
    expiresAt &&
    Number.isFinite(expiresAt.getTime()) &&
    expiresAt.getTime() - now.getTime() <= EXPIRING_SOON_MS
  ) {
    return {
      healthStatus: "expiring_soon",
      healthMessage: "Instagram authorization expires soon. Reconnect before it expires.",
      missingPermissions: [],
      canPublish: true,
    };
  }

  return {
    healthStatus: "healthy",
    healthMessage: "",
    missingPermissions: [],
    canPublish: true,
  };
}
