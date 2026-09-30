"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/components/ui.module.css";

function labelAccountType(value) {
  return {
    BUSINESS: "Business",
    CREATOR: "Creator",
    MEDIA_CREATOR: "Creator",
  }[String(value || "").toUpperCase()] || "Professional";
}

export default function InstagramAccountConfirm({ token, flow }) {
  const [pending, setPending] = useState(false);
  const [connection, setConnection] = useState(null);
  const [error, setError] = useState("");

  async function confirm() {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/connections/instagram/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save this Instagram account.");
      }

      setConnection(result.connection);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  if (connection) {
    return (
      <div className={styles.loginCard}>
        <span className={styles.brandMark}>CS</span>
        <h1>Instagram account connected</h1>
        <p>
          <strong>{connection.accountName}</strong> is now connected to{" "}
          {flow.clientName}. Account Health is currently{" "}
          {connection.healthStatus.replaceAll("_", " ")}.
        </p>
        <Link
          className={styles.button}
          href={`/connections?clientId=${flow.clientId}`}
        >
          Return to Social Accounts
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.loginCard}>
      <span className={styles.brandMark}>CS</span>
      <h1>Confirm Instagram account</h1>
      <p>
        Instagram authorized this Professional account. Confirm that it is the
        destination that belongs to <strong>{flow.clientName}</strong> before it
        is saved.
      </p>

      {error ? <div className={styles.errorNotice}>{error}</div> : null}

      <div className={styles.accountPickerList}>
        <div className={styles.accountPickerItem}>
          <span
            className={styles.connectionAvatar}
            style={
              flow.pictureUrl
                ? { backgroundImage: `url("${flow.pictureUrl}")` }
                : undefined
            }
            aria-hidden="true"
          >
            {!flow.pictureUrl ? flow.username.slice(0, 1).toUpperCase() : null}
          </span>
          <span>
            <strong>@{flow.username}</strong>
            <small>
              Instagram {labelAccountType(flow.accountType)} · ID{" "}
              {flow.providerAccountId}
            </small>
          </span>
        </div>
      </div>

      {flow.missingPermissions?.length ? (
        <div className={styles.errorNotice}>
          Instagram did not grant: {flow.missingPermissions.join(", ")}. You can
          save the account, but Account Health will remain Permission Problem
          until publishing access is granted.
        </div>
      ) : null}

      <button
        className={styles.button}
        type="button"
        onClick={confirm}
        disabled={pending}
      >
        {pending ? "Connecting Account" : "Connect This Instagram Account"}
      </button>
    </div>
  );
}
