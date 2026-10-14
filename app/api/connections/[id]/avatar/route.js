import { getSocialAccountAvatarUrl } from "@/lib/social-account-avatar";
import { requireApiSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    const clientId = new URL(request.url).searchParams.get("clientId");
    const url = await getSocialAccountAvatarUrl(id, clientId);
    if (url) return new Response(null, { status: 307, headers: {
      Location: url, "Cache-Control": "private, max-age=300", Vary: "Cookie",
      "Referrer-Policy": "no-referrer",
    } });
  } catch {
    // Photo failure is independent of publishing health. Do not return provider
    // errors, token-bearing URLs or credentials to the browser.
  }
  return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}
