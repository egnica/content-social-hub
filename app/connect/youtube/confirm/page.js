import { getYouTubeSelectionFlow } from "@/lib/connections";
import YouTubeAccountConfirm from "@/components/youtube-account-confirm";
import styles from "@/components/ui.module.css";
export const metadata = { title: "Confirm YouTube Channel", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";
export default async function YouTubeConfirmPage({ searchParams }) {
  const params = await searchParams;
  const flow = await getYouTubeSelectionFlow(params?.token);
  return <main className={styles.loginPage}>
    {flow ? <YouTubeAccountConfirm flow={flow} token={params.token} /> :
    <div className={styles.loginCard}><h1>Confirmation expired</h1><p>Start YouTube Connect again.</p></div>}
  </main>;
}
