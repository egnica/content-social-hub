import Link from "next/link";
import styles from "@/components/ui.module.css";

export default function NotFound() {
  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard}>
        <span className={styles.eyebrow}>Not found</span>
        <h1>This item is unavailable</h1>
        <p>It may have moved, or the address may be incomplete.</p>
        <Link className={styles.button} href="/">
          Return to Dashboard
        </Link>
      </section>
    </main>
  );
}
