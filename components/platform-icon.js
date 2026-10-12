import styles from "@/components/ui.module.css";

export default function PlatformIcon({ platform }) {
  return (
    <span
      className={`${styles.platformIcon} ${platform === "instagram" ? styles.instagramIcon : styles.facebookIcon}`}
      aria-hidden="true"
    >
      {platform === "instagram" ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M14.3 22v-9h3l.5-3.5h-3.5V7.3c0-1 .3-1.7 1.8-1.7H18V2.5c-.3 0-1.5-.2-2.8-.2-2.8 0-4.6 1.7-4.6 4.8v2.4H7.5V13h3.1v9z" />
        </svg>
      )}
    </span>
  );
}
