import PageHeader from "@/components/page-header";
import styles from "@/components/ui.module.css";

export default function PlaceholderPage({ eyebrow, title, description, cards }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className={styles.placeholderGrid}>
        {cards.map((card) => (
          <article className={styles.placeholderCard} key={card.title}>
            <span className={styles.eyebrow}>{card.phase}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </article>
        ))}
      </div>
    </>
  );
}
