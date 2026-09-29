export function normalizeFacebookProviderUrl(value) {
  const normalized = String(value || "").trim();

  if (!normalized) return "";

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (normalized.startsWith("//")) {
    return `https:${normalized}`;
  }

  return `https://www.facebook.com/${normalized.replace(/^\/+/, "")}`;
}
