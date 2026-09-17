"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "@/components/ui.module.css";

const links = [
  { href: "/", label: "Dashboard", icon: "01" },
  { href: "/content", label: "Content", icon: "02" },
  { href: "/calendar", label: "Calendar", icon: "03" },
  { href: "/approvals", label: "Approvals", icon: "04" },
  { href: "/reports", label: "Reports", icon: "05" },
  { href: "/clients", label: "Clients", icon: "06" },
  { href: "/analytics", label: "Analytics", icon: "07" },
];

export default function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Primary navigation">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
          >
            <span className={styles.navIcon}>{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
