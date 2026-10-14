import Link from "next/link";
import AppNavigation, { WorkspaceTopbar } from "@/components/app-navigation";
import { UnsavedChangesProvider } from "@/components/unsaved-changes";
import LogoutButton from "@/components/logout-button";
import styles from "@/components/ui.module.css";

export default function AppShell({ children }) {
  return (
    <UnsavedChangesProvider><div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
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
          <LogoutButton />
        </div>
      </aside>

      <div className={styles.main}>
        <WorkspaceTopbar />
        <main id="main-content" tabIndex={-1} className={styles.contentArea}>{children}</main>
      </div>
    </div></UnsavedChangesProvider>
  );
}
