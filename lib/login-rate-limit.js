import "server-only";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const globalForRateLimit = globalThis;

function attempts() {
  if (!globalForRateLimit.__contentSocialHubLoginAttempts) {
    globalForRateLimit.__contentSocialHubLoginAttempts = new Map();
  }

  return globalForRateLimit.__contentSocialHubLoginAttempts;
}

export function getLoginKey(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function checkLoginLimit(key) {
  const record = attempts().get(key);
  const now = Date.now();

  if (!record || now - record.startedAt > WINDOW_MS) {
    attempts().delete(key);
    return { limited: false, retryAfter: 0 };
  }

  const retryAfter = Math.max(
    1,
    Math.ceil((WINDOW_MS - (now - record.startedAt)) / 1000),
  );
  return { limited: record.count >= MAX_ATTEMPTS, retryAfter };
}

export function recordFailedLogin(key) {
  const store = attempts();
  const now = Date.now();
  const record = store.get(key);

  if (!record || now - record.startedAt > WINDOW_MS) {
    store.set(key, { count: 1, startedAt: now });
    return;
  }

  store.set(key, { ...record, count: record.count + 1 });
}

export function clearFailedLogins(key) {
  attempts().delete(key);
}
