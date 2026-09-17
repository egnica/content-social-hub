import styles from "@/components/ui.module.css";

export default function Loading() {
  return (
    <div className={styles.emptyState}>
      <div>
        <h2>Loading workspace</h2>
        <p>Retrieving the latest clients and content.</p>
      </div>
    </div>
  );
}
