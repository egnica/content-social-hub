import styles from "@/components/ui.module.css";

export default function PlatformIcon({ platform }) {
  return (
    <span
      className={`${styles.platformIcon} ${platform === "instagram" ? styles.instagramIcon : platform === "linkedin" ? styles.linkedinIcon : styles.facebookIcon}`}
      aria-hidden="true"
    >
      {platform === "youtube" ? (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7a3 3 0 0 0-2.1-2.1C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7a31 31 0 0 0 0 10 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5A3 3 0 0 0 23 17a31 31 0 0 0 0-10ZM9.5 15.5v-7l6 3.5-6 3.5Z"/></svg>) : platform === "linkedin" ? (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52C22 2.68 21.31 2 20.45 2ZM7.93 18.75H4.98V9.2h2.95v9.55ZM6.45 7.89a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.3 10.86H9.55V9.2h2.83v1.3h.04c.39-.74 1.36-1.53 2.8-1.53 3 0 3.53 1.97 3.53 4.53v5.25Z"/></svg>) : platform === "instagram" ? (
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
