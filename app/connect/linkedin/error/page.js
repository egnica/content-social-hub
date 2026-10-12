import styles from "@/components/ui.module.css";
export const metadata = {
  title: "LinkedIn Connection",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";
const messages = {
  cancelled: "LinkedIn authorization was cancelled. No connection was saved.",
  expired: "This authorization attempt expired. Please start again.",
  invalid: "LinkedIn returned an incomplete authorization response.",
  request: "This LinkedIn connection request is no longer available. Ask for a fresh link.",
  identity: "The authorized LinkedIn profile is different from the profile being reconnected. No credentials were replaced.",
  provider: "LinkedIn could not complete this connection. Check app permissions and try again.",
};
export default async function LinkedInConnectionErrorPage({ searchParams }) {
  const params = await searchParams;
  return <main className={styles.loginPage}><div className={styles.loginCard}>
    <h1>LinkedIn was not connected</h1>
    <p>{messages[params?.reason] || messages.provider}</p>
  </div></main>;
}
