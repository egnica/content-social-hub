import Link from "next/link";
import PageHeader from "@/components/page-header";
import styles from "@/components/ui.module.css";
import { formatDate } from "@/lib/format";

export default function DashboardOverview({ dashboard }) {
  const stats = [
    { label: "Active clients", value: dashboard.activeClients, href: "/clients", note: "Manage clients" },
    { label: "Saved content", value: dashboard.savedContent, href: "/content", note: "Open the content library" },
    { label: "Social accounts", value: dashboard.connectedAccounts, href: "/connections", note: "Manage connected accounts" },
    { label: "Accounts needing attention", value: dashboard.connectionProblems, href: "/connections", note: dashboard.connectionProblems ? "Review account health" : "No recorded health issues" },
  ];
  const nextAction = !dashboard.activeClients
    ? { title: "Start with a client", text: "Add the client whose content you want to manage.", href: "/clients", label: "Add a client" }
    : dashboard.connectionProblems
      ? { title: "Review your social accounts", text: `${dashboard.connectionProblems} account${dashboard.connectionProblems === 1 ? " needs" : "s need"} attention. Check account health before publishing.`, href: "/connections", label: "Review accounts" }
      : !dashboard.connectedAccounts
        ? { title: "Connect a social account", text: "Choose a client, then connect the accounts you want to publish to.", href: "/connections", label: "Connect an account" }
        : { title: "Prepare your next post", text: "Create shared content, choose its accounts, then review each post before publishing or scheduling.", href: "/content/new", label: "Create content" };
  return <>
    <PageHeader eyebrow="All clients" title="Your publishing workspace" description="Pick up where you left off or prepare your next post." />
    <section className={styles.nextAction} aria-label="Suggested next action">
      <div><span className={styles.eyebrow}>Next step</span><h2>{nextAction.title}</h2><p>{nextAction.text}</p></div>
      <Link href={nextAction.href} className={styles.button}>{nextAction.label} →</Link>
    </section>
    <section className={styles.panel}>
      <div className={styles.panelHeader}><h2>Continue working</h2><Link className={styles.buttonGhost} href="/content">View all content →</Link></div>
      <div className={styles.panelBody}>
        {dashboard.recentContent.length ? <div className={styles.activityList}>
          {dashboard.recentContent.map(item => <Link className={styles.attentionItem} href={`/content/${item._id}`} key={item._id}>
            <span className={styles.attentionDot} /><span><strong>{item.internalTitle}</strong><p>{item.clientName} · Updated {formatDate(item.updatedAt)}</p></span><span className={styles.resumeAction}>Open →</span>
          </Link>)}
        </div> : <div className={styles.notice}>Your saved content will appear here. <Link href={dashboard.activeClients ? "/content/new" : "/clients"}>{dashboard.activeClients ? "Create your first content item →" : "Add your first client →"}</Link></div>}
      </div>
    </section>
    <section className={styles.statsGrid} aria-label="Workspace summary">
      {stats.map(stat => <Link className={styles.statCard} href={stat.href} key={stat.label}>
        <span className={styles.eyebrow}>{stat.label}</span><div className={styles.statValue}>{stat.value}</div><p className={styles.statNote}>{stat.note} →</p>
      </Link>)}
    </section>
  </>;
}
