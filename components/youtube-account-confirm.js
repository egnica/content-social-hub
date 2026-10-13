"use client";
import { useState } from "react";
import styles from "@/components/ui.module.css";
export default function YouTubeAccountConfirm({ flow, token }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/connections/youtube/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the YouTube channel.");
      setDone(true);
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }
  return <div className={styles.loginCard}>
    <span className={styles.brandMark}>YT</span>
    <h1>{done ? "YouTube connected" : "Confirm YouTube channel"}</h1>
    <p>{done ? "The selected channel is saved to the correct client." :
      `Connect “${flow.accountName}” to “${flow.clientName}”?`}</p>
    {!done && <div className={styles.notice}>
      <strong>Channel ID:</strong> {flow.providerAccountId}
      <p>Check the channel name and ID carefully. This is the publishing destination, not your Google email address. No video will be posted.</p>
    </div>}
    {error && <div className={styles.errorNotice}>{error}</div>}
    {!done && <button type="button" className={styles.button} disabled={busy} onClick={confirm}>{busy ? "Saving" : "Confirm channel"}</button>}
    {done && flow.mode === "owner" && <a className={styles.button} href={`/connections?clientId=${flow.clientId}`}>Back to Social Accounts</a>}
  </div>;
}
