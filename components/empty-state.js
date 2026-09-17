import styles from "@/components/ui.module.css";

export default function EmptyState({ title, description, children }) {
  return (
    <div className={styles.emptyState}>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
      </div>
    </div>
  );
}
