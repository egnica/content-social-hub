"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/components/ui.module.css";

const primaryLinks = [
  { href: "/", label: "Dashboard", icon: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z" },
  { href: "/content", label: "Content", icon: "M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7" },
  { href: "/clients", label: "Clients", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M18 8a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4 M13 7a4 4 0 1 1-8 0a4 4 0 0 1 8 0" },
  { href: "/connections", label: "Social Accounts", icon: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" },
];
const plannedLinks = [
  { href: "/calendar", label: "Calendar" },
  { href: "/approvals", label: "Approvals" },
  { href: "/reports", label: "Reports" },
  { href: "/analytics", label: "Analytics" },
];
function isActive(pathname, href) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppNavigation() {
  const pathname = usePathname();
  function navigationLink(link) {
    const active = isActive(pathname, link.href);
    return <Link key={link.href} href={link.href}
      className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
      aria-current={active ? "page" : undefined}>
      {link.icon ? <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={link.icon} /></svg> : null}
      {link.label}
      {!link.icon ? <small className={styles.plannedBadge}>Planned</small> : null}
    </Link>;
  }
  return <nav aria-label="Primary navigation">
    <div className={styles.nav}>{primaryLinks.map(navigationLink)}</div>
    <details className={styles.plannedNavigation} open={plannedLinks.some(link => isActive(pathname, link.href))}>
      <summary>Coming later</summary>
      <div className={styles.plannedLinks}>{plannedLinks.map(navigationLink)}</div>
    </details>
  </nav>;
}

export function WorkspaceTopbar() {
  const pathname = usePathname();
  const section = [...primaryLinks, ...plannedLinks].find(link => isActive(pathname, link.href));
  const creating = pathname === "/content/new";
  return <header className={styles.topbar}>
    <nav className={styles.workspaceBreadcrumb} aria-label="Workspace breadcrumb">
      <Link href="/">Workspace</Link>
      {pathname !== "/" && section ? <><span aria-hidden="true">/</span><span>{creating ? "Create content" : section?.label || "Workspace"}</span></> : null}
    </nav>
    {pathname === "/content" || /^\/clients\/[^/]+$/.test(pathname) ? null : !creating ? <Link className={styles.button} href="/content/new">+ Create Content</Link> : <Link className={styles.buttonSecondary} href="/content">View Content</Link>}
  </header>;
}
