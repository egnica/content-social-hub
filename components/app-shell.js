import Link from "next/link";
import AppNavigation from "@/components/app-navigation";
import LogoutButton from "@/components/logout-button";
import styles from "@/components/ui.module.css";

export default function AppShell({ children }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/">
          <span className={styles.brandMark}>CS</span>
          <span className={styles.brandText}>
            <strong>Content Social Hub</strong>
            <span>Publishing workspace</span>
          </span>
        </Link>

        <AppNavigation />

        <div className={styles.sidebarFooter}>
          <div className={styles.contextCard}>
            <span>Current view</span>
            <strong>All Clients</strong>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <span className={styles.topbarLabel}>All Clients</span>
          <div className={styles.topbarActions}>
            <Link className={styles.buttonSecondary} href="/clients">
              Add Client
            </Link>
            <Link className={styles.button} href="/content/new">
              + Create Content
            </Link>
          </div>
        </header>
        <main className={styles.contentArea}>{children}</main>
      </div>
    </div>
  );
}
