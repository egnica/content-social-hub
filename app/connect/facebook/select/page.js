import FacebookAccountPicker from "@/components/facebook-account-picker";
import { getFacebookSelectionFlow } from "@/lib/connections";
import styles from "@/components/ui.module.css";

export const metadata = {
  title: "Choose Facebook Page",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function FacebookSelectionPage({ searchParams }) {
  const params = await searchParams;
  const token = params?.token || "";
  const flow = await getFacebookSelectionFlow(token);

  if (!flow) {
    return (
      <main className={styles.loginPage}>
        <div className={styles.loginCard}>
          <span className={styles.brandMark}>CS</span>
          <h1>Account selection expired</h1>
          <p>
            Restart the Facebook connection. For security, unfinished account
            selections expire quickly.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.loginPage}>
      <FacebookAccountPicker token={token} flow={flow} />
    </main>
  );
}
