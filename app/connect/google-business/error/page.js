import { getSession } from "@/lib/session";
import styles from "@/components/ui.module.css";

export const metadata = { title: "Google Business Connection", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";
const messages = {
  expired: "The authorization expired or was already used. Start Connect again.",
  request: "This connection request expired, was replaced or is already completed. Ask for a fresh link.",
  invalid: "This authorization does not match the browser that started Connect. Start again in the same browser.",
  cancelled: "Google authorization was cancelled. No connection was saved.",
  quota: "Google blocked business lookup because of a quota limit. If your project's quota is 0, Google must approve Business Profile API access before location selection can work.",
  disabled: "Enable My Business Account Management API and My Business Business Information API in the same Google Cloud project as these credentials.",
  permissions: "Google denied Business Profile access. Check project approval, business.manage consent, and whether this Google account owns or manages the intended location.",
  authorization: "Google authorization expired or was revoked. Start Connect again.",
  identity: "Google did not return an eligible business location, the required permission was not granted, or the original location was not available for reconnect. No connection was replaced.",
  incomplete: "Google could not return the complete business location list within the lookup limit. Try again or use a Google account with fewer managed locations.",
  provider: "Google Business Profile could not complete this connection. Start Connect again.",
  unavailable: "Google Business Profile is temporarily unavailable. Try again later.",
};
export default async function GoogleBusinessErrorPage({ searchParams }) {
  const session = await getSession();
  const params = await searchParams;
  const clientId = typeof params?.clientId === "string" && /^[a-f0-9]{24}$/i.test(params.clientId) ? params.clientId : "";
  return <main className={styles.loginPage}><div className={styles.loginCard}>
    <h1>Google Business was not connected</h1><p role="alert">{messages[params?.reason] || messages.provider}</p>
    {session ? <a className={styles.button} href={clientId ? `/connections?clientId=${clientId}` : "/connections"}>Back to Social Accounts</a>
      : <p>Use the original setup link to try again, or ask the sender for a new link.</p>}
  </div></main>;
}
