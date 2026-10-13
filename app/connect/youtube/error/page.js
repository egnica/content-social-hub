import styles from "@/components/ui.module.css";
export const metadata = { title: "YouTube Connection", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";
const messages = {
  expired: "This YouTube authorization expired. Start again.",
  invalid: "Google returned an incomplete authorization response.",
  cancelled: "Google authorization was cancelled. No connection was saved.",
  identity: "The authorized channel did not match the expected channel, or YouTube could not identify a single channel. No connection was replaced.",
  provider: "Google or YouTube could not verify this authorization. No connection was saved.",
};
export default async function YouTubeErrorPage({ searchParams }) {
  const params = await searchParams;
  return <main className={styles.loginPage}><div className={styles.loginCard}>
    <h1>YouTube was not connected</h1><p>{messages[params?.reason] || messages.provider}</p>
  </div></main>;
}
