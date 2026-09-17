"use client";

import styles from "@/components/ui.module.css";

export default function AppError({ reset }) {
  return (
    <div className={styles.emptyState}>
      <div>
        <h2>The workspace could not load</h2>
        <p>Check the application configuration and try again.</p>
        <button className={styles.button} type="button" onClick={reset}>
          Try Again
        </button>
      </div>
    </div>
  );
}
