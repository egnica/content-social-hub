import PageHeader from "@/components/page-header";
import styles from "@/components/ui.module.css";

export default function PlaceholderPage({ title, description, cards }) {
  return (
    <>
      <PageHeader eyebrow="Coming later" title={title} description={description} backHref="/" backLabel="Dashboard" />
      <div className={styles.placeholderGrid}>
        {cards.map((card) => (
          <article className={styles.placeholderCard} key={card.title}>
            <span className={styles.eyebrow}>Planned</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </article>
        ))}
      </div>
    </>
  );
}
