import { apiError, readJson } from "@/lib/api";
import { isValidAdminPassword } from "@/lib/auth";
import {
  checkLoginLimit,
  clearFailedLogins,
  getLoginKey,
  recordFailedLogin,
} from "@/lib/login-rate-limit";
import { createSession } from "@/lib/session";

export async function POST(request) {
  try {
    const loginKey = getLoginKey(request);
    const limit = checkLoginLimit(loginKey);

    if (limit.limited) {
      return Response.json(
        { error: "Too many sign-in attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const body = await readJson(request);

    if (!isValidAdminPassword(body.password)) {
      recordFailedLogin(loginKey);
      return Response.json({ error: "Incorrect password." }, { status: 401 });
    }

    clearFailedLogins(loginKey);
    await createSession();
    return Response.json({ authenticated: true });
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return apiError(error, "Unable to sign in.");
  }
}
