"use client";

import { useEffect, useState } from "react";
import styles from "@/components/ui.module.css";
import PublishedPostSummary from "@/components/published-post-summary";
import { validateGoogleBusinessPublish } from "@/lib/google-business-publish-logic";

export default function GoogleBusinessPublishControls({ version, form, masterContent, dirty, busy, onChange }) {
  const [attempts, setAttempts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const current = attempts.find(item => Number(item.platformVersionRevision) === Number(version.revision));
  const status = current?.status || version.lastPublishStatus || "";
  const locked = version.googlePublishLock || Boolean(version.publishedRevision) ||
    ["submitting", "processing", "unknown", "succeeded", "rejected"].includes(status);
  const validation = validateGoogleBusinessPublish({ ...version, ...form }, masterContent);
  const postUrl = current?.providerPostUrl || version.providerPostUrl || "";
  const endpoint = `/api/platform-versions/${version._id}/publish`;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/platform-versions/${version._id}/publish-attempts`, { cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load Google publish history.");
        return data;
      }).then(data => { if (!cancelled) { setAttempts(data.attempts || []); setLoaded(true); } })
      .catch(err => { if (!cancelled) { setError(err.message); setLoaded(false); } });
    return () => { cancelled = true; };
  }, [version._id, version.revision]);
  async function submit(refreshOnly = false) {
    if (working || busy || (!refreshOnly && (dirty || locked || !loaded || !validation.publishable))) return;
    if (!refreshOnly && !window.confirm([
      `Publish this Google update to ${version.destinationName || "this business location"}?`,
      `Location: ${version.googleBusinessParent || version.providerAccountId}`,
      `Saved revision: ${version.revision}`, "", form.summary, "",
      `Button: ${form.ctaType || "None"}`, form.ctaUrl || "",
      "This submits a real Google Business Profile post. Google may review or reject it.",
    ].join("\n"))) return;
    setWorking(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, refreshOnly ? { cache: "no-store" } : {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: version.revision }),
      });
      const result = await response.json();
      if (result.attempt) {
        setAttempts(previous => [result.attempt, ...previous.filter(item => item._id !== result.attempt._id)]);
        onChange(result.platformVersion || { ...version,
          lastPublishStatus: result.attempt.status,
          lastPublishAttemptId: result.attempt._id,
          googlePublishLock: result.attempt.status !== "failed",
        });
      }
      if (!response.ok) throw new Error(result.error || "Google publication could not be confirmed. Reload and check history before retrying.");
      if (result.platformVersion) onChange(result.platformVersion);
      setNotice(result.attempt?.status === "succeeded" ? "Google reports this post is live." :
        result.attempt?.status === "rejected" ? "Google rejected this post. Review its policy and create a new draft." :
        "Google accepted the post and is processing it. It is not confirmed live yet.");
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  }
  return <section className={styles.platformEditor} aria-label="Google Business publishing">
    {status === "succeeded" ? <PublishedPostSummary platformLabel="Google" destinationName={version.destinationName}
      version={version} attempt={current} postUrl={postUrl} timezone={masterContent.clientTimezone}
      resultLabel="Reported live" postLabel="View Post ↗" /> : null}
    {status !== "succeeded" ? <>
      <div className={styles.sectionHeader}><h3>Publish Now</h3><p>Publish this saved text update to {version.destinationName}.</p></div>
      {dirty ? <p className={styles.notice}>Save the Google draft before publishing.</p> : null}
      {status === "processing" ? <p role="status" className={styles.notice}>Google is processing this post. It is not confirmed live. Refresh status checks the same recorded post.</p> : null}
      {status === "unknown" || status === "submitting" ? <p className={styles.errorNotice}>This submission needs review. Check the recorded post on Google before taking further action. Duplicate publication is blocked.</p> : null}
      {status === "rejected" ? <p className={styles.errorNotice}>Google rejected this post. Create a new draft after reviewing its content policy.</p> : null}
      {!locked && validation.blocking.length ? <ul className={styles.notice}>{validation.blocking.map(item => <li key={item}>{item}</li>)}</ul> : null}
      <button type="button" className={styles.button} onClick={() => submit()}
        disabled={working || busy || dirty || locked || !loaded || !validation.publishable}>
        {working ? "Checking Google…" : locked ? "Submission recorded" : status === "failed" ? "Retry Publish" : "Publish Now"}
      </button>
    </> : null}
    {(locked && (status !== "succeeded" || !postUrl)) ? <button type="button" className={styles.buttonSecondary}
      onClick={() => submit(true)} disabled={working || busy}>Refresh Google status</button> : null}
    {error ? <p role="alert" className={styles.errorNotice}>{error}</p> : null}
    {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
    <details className={styles.publishHistory}><summary>Publishing activity</summary>
      {!loaded ? <p>Publish history is unavailable. Reload before publishing.</p> : null}
      {attempts.map(attempt => <div className={styles.notice} key={attempt._id}>
        <strong>{attempt.status === "unknown" ? "Review required" : attempt.status}</strong>{" · Revision "}{attempt.platformVersionRevision}
        {attempt.providerState ? <p>Google state: {attempt.providerState}</p> : null}
        {attempt.providerError?.message ? <p>{attempt.providerError.message}</p> : null}
        {attempt.providerPostUrl ? <a className={styles.buttonSecondary} href={attempt.providerPostUrl} target="_blank" rel="noreferrer">View Post ↗</a> : null}
      </div>)}
      {loaded && !attempts.length ? <p>No Google publish attempts yet.</p> : null}
    </details>
    <p className={styles.fieldHint}>Google scheduling is not enabled yet. Release preferences remain draft metadata.</p>
  </section>;
}
