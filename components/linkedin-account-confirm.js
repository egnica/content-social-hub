"use client";

import { useState } from "react";
import styles from "@/components/ui.module.css";

export default function LinkedInAccountConfirm({ flow, token }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function confirm() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/connections/linkedin/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not connect LinkedIn.");
      setDone(true);
    } catch (issue) {
      setError(issue.message);
    } finally { setSaving(false); }
  }
  return <div className={styles.loginCard}>
    <span className={styles.brandMark}>CS</span>
    <h1>{done ? "LinkedIn connected" : "Confirm LinkedIn profile"}</h1>
    <p>{done ? "This profile is now connected to the selected client." :
      `Connect ${flow.accountName} to ${flow.clientName}?`}</p>
    {!done && <div className={styles.notice}>
      This connects a personal LinkedIn profile, not a Company Page.
      Reconnecting the same profile replaces its authorization without deleting history.
    </div>}
    {error && <div className={styles.errorNotice}>{error}</div>}
    {!done && <button className={styles.button} type="button" disabled={saving}
      onClick={confirm}>{saving ? "Saving" : "Confirm connection"}</button>}
    {done && flow.mode === "owner" && <a className={styles.button}
      href={`/connections?clientId=${flow.clientId}`}>Back to Social Accounts</a>}
  </div>;
}
