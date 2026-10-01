import styles from "@/components/ui.module.css";

export const metadata = {
  title: "Instagram Connection",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

const messages = {
  cancelled: "Instagram authorization was cancelled. No connection was saved.",
  expired: "This authorization attempt expired. Please start the connection again.",
  invalid: "Instagram returned an incomplete authorization response.",
  identity: "Instagram returned conflicting account identity data. No connection was saved.",
  request: "This Instagram connection request is no longer available. Ask the sender for a fresh connection link.",
  provider: "Instagram could not complete this connection. Please try again.",
};

export default async function InstagramConnectionErrorPage({ searchParams }) {
  const params = await searchParams;
  const reason = params?.reason || "provider";

  return (
    <main className={styles.loginPage}>
      <div className={styles.loginCard}>
        <span className={styles.brandMark}>CS</span>
        <h1>Instagram was not connected</h1>
        <p>{messages[reason] || messages.provider}</p>
      </div>
    </main>
  );
}
