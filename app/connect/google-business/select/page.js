import { redirect } from "next/navigation";
import { getGoogleBusinessSelectionFlow } from "@/lib/connections";
import { getSession } from "@/lib/session";
import { GOOGLE_BUSINESS_SELECTION_COOKIE, matchesGoogleBusinessBrowser } from "@/lib/google-business-oauth-browser";
import GoogleBusinessLocationSelect from "@/components/google-business-location-select";
import styles from "@/components/ui.module.css";

export const metadata = { title: "Connect Google Business Profile", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";
export default async function GoogleBusinessSelectPage({ searchParams }) {
  const params = await searchParams;
  const flow = await matchesGoogleBusinessBrowser(GOOGLE_BUSINESS_SELECTION_COOKIE, params?.token)
    ? await getGoogleBusinessSelectionFlow(params.token) : null;
  if (flow?.mode === "owner" && !await getSession()) redirect("/login");
  return <main className={styles.loginPage}>{flow
    ? <GoogleBusinessLocationSelect flow={flow} token={params.token} />
    : <div className={styles.loginCard}><h1>Location selection expired</h1>
      <p>Restart Google Business Connect using the original setup link or Social Accounts.</p></div>}</main>;
}
