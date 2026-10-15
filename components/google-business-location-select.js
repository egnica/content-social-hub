"use client";
import { useRef, useState } from "react";
import PlatformIcon from "@/components/platform-icon";
import styles from "@/components/ui.module.css";

export default function GoogleBusinessLocationSelect({ flow, token }) {
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState("");
  const errorRef = useRef(null);
  async function confirm(event) {
    event.preventDefault();
    if (busy || !selected) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/connections/google-business/confirm", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, providerParent: selected }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save this business location. Restart Connect.");
      setDone(true);
    } catch (issue) { setError(issue.message); requestAnimationFrame(() => errorRef.current?.focus()); }
    finally { setBusy(false); }
  }
  return <div className={`${styles.loginCard} ${styles.googleBusinessPicker}`}>
    <PlatformIcon platform="google_business_profile" />
    <h1>{done ? "Business location connected" : flow.reconnecting ? "Confirm original business location" : "Choose a business location"}</h1>
    <p>{done ? `The selected location is saved to “${flow.clientName}”.` : `Choose the exact business location to connect to “${flow.clientName}”.`}</p>
    <p className={styles.fieldHint}>This connects account access. Posting is a separate upcoming step. No business details or posts will be changed.</p>
    {!done && <form onSubmit={confirm}>
      <fieldset disabled={busy} className={styles.googleBusinessLocations}>
        <legend>Business locations</legend>
        {flow.locations.map(location => <label key={location.providerParent} className={styles.googleBusinessLocation}>
          <input type="radio" name="businessLocation" value={location.providerParent} checked={selected === location.providerParent}
            onChange={() => setSelected(location.providerParent)} />
          <span><strong>{location.accountName}</strong>
            <span>{location.address || "Service-area business or address not provided"}</span>
            <span>Google account: {location.googleAccountName}</span>
            <small>{location.providerParent}</small></span>
        </label>)}
      </fieldset>
      {error && <div className={styles.errorNotice} role="alert" ref={errorRef} tabIndex={-1}>{error}</div>}
      <button className={styles.button} type="submit" disabled={busy || !selected}>{busy ? "Connecting" : "Confirm location"}</button>
    </form>}
    <a className={styles.buttonSecondary} href={`/connections?clientId=${flow.clientId}`}>Back to Social Accounts</a>
  </div>;
}
