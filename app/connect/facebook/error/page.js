import styles from "@/components/ui.module.css";

export const metadata = {
  title: "Facebook Connection",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

const messages = {
  cancelled: "Facebook authorization was cancelled. No connection was saved.",
  request: "This connection request is no longer available. Ask for a new link.",
  expired: "This authorization attempt expired. Please start the connection again.",
  invalid: "Facebook returned an incomplete authorization response.",
  provider: "Facebook could not complete this connection. Please try again.",
};

export default async function FacebookConnectionErrorPage({ searchParams }) {
  const params = await searchParams;
  const reason = params?.reason || "provider";

  return (
    <main className={styles.loginPage}>
      <div className={styles.loginCard}>
        <span className={styles.brandMark}>CS</span>
        <h1>Facebook was not connected</h1>
        <p>{messages[reason] || messages.provider}</p>
      </div>
    </main>
  );
}
