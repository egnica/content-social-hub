"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/components/ui.module.css";

export default function FacebookAccountPicker({
  token,
  flow,
}) {
  const [selected, setSelected] = useState(
    flow.candidates.length === 1
      ? flow.candidates[0].providerAccountId
      : "",
  );
  const [pending, setPending] = useState(false);
  const [connection, setConnection] = useState(null);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();

    if (!selected) {
      setError("Choose the Facebook Page that belongs to this client.");
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/connections/facebook/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          providerAccountId: selected,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save this Facebook Page.");
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
        <h1>Facebook Page connected</h1>
        <p>
          <strong>{connection.accountName}</strong> is now connected to{" "}
          {flow.clientName}. Account Health is currently{" "}
          {connection.healthStatus.replaceAll("_", " ")}.
        </p>
        {flow.mode === "owner" ? (
          <Link
            className={styles.button}
            href={`/connections?clientId=${flow.clientId}`}
          >
            Return to Social Accounts
          </Link>
        ) : (
          <div className={styles.successNotice}>
            Setup is complete. You can safely close this page.
          </div>
        )}
      </div>
    );
  }

  return (
    <form className={styles.loginCard} onSubmit={submit}>
      <span className={styles.brandMark}>CS</span>
      <h1>Choose the correct Page</h1>
      <p>
        Facebook returned the Pages available to this account. Select the one
        that belongs to <strong>{flow.clientName}</strong>.
      </p>

      {error ? <div className={styles.errorNotice}>{error}</div> : null}

      {flow.candidates.length ? (
        <div className={styles.accountPickerList}>
          {flow.candidates.map((candidate) => (
            <label className={styles.accountPickerItem} key={candidate.providerAccountId}>
              <input
                type="radio"
                name="facebookPage"
                value={candidate.providerAccountId}
                checked={selected === candidate.providerAccountId}
                onChange={(event) => setSelected(event.target.value)}
              />
              <span
                className={styles.connectionAvatar}
                style={
                  candidate.pictureUrl
                    ? { backgroundImage: `url("${candidate.pictureUrl}")` }
                    : undefined
                }
                aria-hidden="true"
              >
                {!candidate.pictureUrl
                  ? candidate.accountName.slice(0, 1).toUpperCase()
                  : null}
              </span>
              <span>
                <strong>{candidate.accountName}</strong>
                <small>Facebook Page</small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className={styles.errorNotice}>
          Facebook did not return an eligible Page. Confirm that this Facebook
          user has Page access with permission to create content.
        </div>
      )}

      <button
        className={styles.button}
        type="submit"
        disabled={pending || !flow.candidates.length}
      >
        {pending ? "Connecting Page" : "Connect Selected Page"}
      </button>
    </form>
  );
}
