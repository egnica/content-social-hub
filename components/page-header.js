import styles from "@/components/ui.module.css";

export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className={styles.pageHeader}>
      <div>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className={styles.topbarActions}>{actions}</div> : null}
    </header>
  );
}
