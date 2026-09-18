import Link from "next/link";
import PageHeader from "@/components/page-header";
import styles from "@/components/ui.module.css";
import { getDashboardData } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dashboard = await getDashboardData();
  const stats = [
    { label: "Active Clients", value: dashboard.activeClients, note: "Ready for content" },
    { label: "Master Content", value: dashboard.savedContent, note: "Saved packages" },
    { label: "Private Media", value: dashboard.uploadedMedia, note: "Uploaded originals" },
    { label: "Social Accounts", value: dashboard.connectedAccounts, note: dashboard.connectionProblems ? `${dashboard.connectionProblems} need attention` : "Connections healthy" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="All Clients"
        title="Operational overview"
        description="The content foundation is active. Facebook Page connections and Account Health are now the first live social adapter."
        actions={
          <Link className={styles.button} href="/content/new">
            + Create Content
          </Link>
        }
      />

      <section className={styles.statsGrid}>
        {stats.map((stat) => (
          <article className={styles.statCard} key={stat.label}>
            <span className={styles.eyebrow}>{stat.label}</span>
            <div className={styles.statValue}>{stat.value}</div>
            <p className={styles.statNote}>{stat.note}</p>
          </article>
        ))}
      </section>

      <section className={styles.dashboardGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Recent Content</h2>
            <Link className={styles.buttonGhost} href="/content">
              View all
            </Link>
          </div>
          <div className={styles.panelBody}>
            {dashboard.recentContent.length ? (
              <div className={styles.activityList}>
                {dashboard.recentContent.map((item) => (
                  <Link
                    className={styles.attentionItem}
                    href={`/content/${item._id}`}
                    key={item._id}
                  >
                    <span className={styles.attentionDot} />
                    <span>
                      <strong>{item.internalTitle}</strong>
                      <p>
                        {item.clientName} · Updated {formatDate(item.updatedAt)}
                      </p>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className={styles.notice}>
                Create your first client and Master Content package to begin.
              </div>
            )}
          </div>
        </div>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Foundation status</h2>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.attentionList}>
              <div className={styles.attentionItem}>
                <span className={styles.attentionDot} />
                <div>
                  <strong>MongoDB persistence</strong>
                  <p>Clients, content, and media records are stored centrally.</p>
                </div>
              </div>
              <div className={styles.attentionItem}>
                <span className={styles.attentionDot} />
                <div>
                  <strong>Private S3 uploads</strong>
                  <p>Original media uses short-lived signed upload URLs.</p>
                </div>
              </div>
              <div className={styles.attentionItem}>
                <span className={styles.attentionDot} />
                <div>
                  <strong>Facebook Pages</strong>
                  <p>
                    {dashboard.connectedAccounts
                      ? `${dashboard.connectedAccounts} account connection${dashboard.connectedAccounts === 1 ? "" : "s"} saved.`
                      : "Ready for the first OAuth connection."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}
