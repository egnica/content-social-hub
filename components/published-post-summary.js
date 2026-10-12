import Link from "next/link";
import styles from "@/components/ui.module.css";

export default function PublishedPostSummary({
  platformLabel,
  destinationName,
  version,
  attempt,
  postUrl,
  timezone,
}) {
  const publishedAt = attempt?.completedAt || version.publishedAt;
  let dateLabel = "Publication time unavailable";
  if (publishedAt && !Number.isNaN(new Date(publishedAt).getTime())) {
    try {
      dateLabel =
        new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: timezone || "UTC",
        }).format(new Date(publishedAt)) + ` · ${timezone || "UTC"}`;
    } catch {
      dateLabel = new Date(publishedAt).toISOString();
    }
  }
  return (
    <div className={styles.publishedSummary}>
      <div>
        <strong>
          Published to {destinationName} on {platformLabel}
        </strong>
        <p>{dateLabel}</p>
      </div>
      <div className={styles.publishedActions}>
        {postUrl ? (
          <a
            className={styles.button}
            href={postUrl}
            target="_blank"
            rel="noreferrer"
          >
            View {platformLabel} post ↗
          </a>
        ) : (
          <span className={styles.fieldHint}>
            The exact post link is not available yet.
          </span>
        )}
        <Link
          className={styles.buttonSecondary}
          href={`/content/new?from=${version.masterContentId}`}
        >
          Create a new draft
        </Link>
      </div>
    </div>
  );
}
