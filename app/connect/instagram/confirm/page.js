import InstagramAccountConfirm from "@/components/instagram-account-confirm";
import { getInstagramSelectionFlow } from "@/lib/connections";
import styles from "@/components/ui.module.css";

export const metadata = {
  title: "Confirm Instagram Account",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function InstagramConfirmationPage({ searchParams }) {
  const params = await searchParams;
  const token = params?.token || "";
  const flow = await getInstagramSelectionFlow(token);

  if (!flow) {
    return (
      <main className={styles.loginPage}>
        <div className={styles.loginCard}>
          <span className={styles.brandMark}>CS</span>
          <h1>Instagram confirmation expired</h1>
          <p>
            Restart the Instagram connection. For security, unfinished account
            confirmations expire quickly.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.loginPage}>
      <InstagramAccountConfirm token={token} flow={flow} />
    </main>
  );
}
