"use client";

import AccountAvatar from "@/components/account-avatar";
import { getConnectionHealthDisplay, getConnectionReconnectUrl } from "@/lib/connection-health-display";
import styles from "@/components/ui.module.css";

const PLATFORM_NAMES = {
  facebook: "Facebook Page",
  instagram: "Instagram Professional",
  linkedin: "LinkedIn personal profile",
  youtube: "YouTube channel",
  google_business_profile: "Google Business Profile location",
};

function formatDate(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "Not yet";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function SocialConnectionCard({ connection, checking, onCheckHealth, checkedAsOf }) {
  const health = getConnectionHealthDisplay(connection, { now: checkedAsOf });
  const reconnectUrl = getConnectionReconnectUrl(connection);
  const showDetails = connection.platform === "google_business_profile" ||
    (connection.platform === "linkedin" && Boolean(connection.tokenExpiresAt));

  return (
    <article className={styles.connectionItem} id={`account-${connection._id}`} tabIndex={-1}>
      <AccountAvatar connection={connection} />
      <div className={styles.connectionIdentity}>
        <strong>{connection.accountName}</strong>
        <span>{PLATFORM_NAMES[connection.platform] || "Social account"}</span>
        {health.needsAttention && connection.healthMessage ? (
          <p className={styles.connectionProblem}>{connection.healthMessage}</p>
        ) : null}
      </div>
      <div className={styles.connectionHealth}>
        <span className={health.healthy ? styles.successBadge : health.needsAttention ? styles.statusBadge : styles.neutralBadge}>
          {health.label}
        </span>
        <span>Last checked {formatDate(connection.lastHealthCheckAt)}</span>
        {health.stale && <span className={styles.connectionStale}>Recheck recommended</span>}
      </div>
      <div className={styles.connectionItemActions}>
        <button className={styles.buttonSecondary} type="button"
          onClick={() => onCheckHealth(connection._id)} disabled={checking}>
          {checking ? "Checking" : "Check health"}
        </button>
        {reconnectUrl ? (
          <a className={styles.buttonGhost} href={reconnectUrl}
            title="Reauthorize this saved social connection">Reconnect</a>
        ) : null}
      </div>
      {showDetails ? (
        <details className={styles.connectionDetails}>
          <summary>Connection details</summary>
          {connection.platform === "google_business_profile" ? (
            <div>
              <p>{connection.address || "Service-area business; no street address supplied"}</p>
              <p>Google resource: {connection.providerParent}</p>
              <p>Publishing to Google Business Profile is not yet enabled.</p>
            </div>
          ) : null}
          {connection.platform === "linkedin" && connection.tokenExpiresAt ? (
            <p>LinkedIn authorization expires {formatDate(connection.tokenExpiresAt)}</p>
          ) : null}
        </details>
      ) : null}
    </article>
  );
}
