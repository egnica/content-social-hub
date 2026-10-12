import { getLinkedInSelectionFlow } from "@/lib/connections";
import LinkedInAccountConfirm from "@/components/linkedin-account-confirm";
import styles from "@/components/ui.module.css";

export const metadata = {
  title: "Confirm LinkedIn Profile",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function LinkedInConfirmPage({ searchParams }) {
  const params = await searchParams;
  const token = params?.token || "";
  const flow = await getLinkedInSelectionFlow(token);
  if (!flow) return (
    <main className={styles.loginPage}><div className={styles.loginCard}>
      <h1>LinkedIn confirmation expired</h1>
      <p>Restart LinkedIn Connect. Unfinished confirmations expire quickly.</p>
    </div></main>
  );
  return <main className={styles.loginPage}><LinkedInAccountConfirm flow={flow} token={token} /></main>;
}
