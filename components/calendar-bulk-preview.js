"use client";

import { useState } from "react";
import styles from "@/components/ui.module.css";

export default function CalendarBulkPreview({ client, accounts, draftImportEnabled = false }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftResults, setDraftResults] = useState([]);
  const [draftError, setDraftError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setPreview(null);
    setDraftResults([]);
    setDraftError("");
    setError("");
    if (!file) return setError("Choose a .csv or .xlsx file.");
    const form = new FormData();
    form.set("clientId", client.id);
    form.set("file", file);
    setLoading(true);
    try {
      const response = await fetch("/api/calendar/bulk-preview", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to read workbook.");
      setPreview(result.preview);
    } catch (caught) {
      setError(caught.message || "Unable to read workbook.");
    } finally {
      setLoading(false);
    }
  }

  async function createDrafts() {
    if (!client || !file || !preview?.valid || !draftImportEnabled) return;
    if (!window.confirm("Create " + preview.posts.length + " Master Content drafts for " +
      client.name + "? This creates drafts only. Nothing will be scheduled or published.")) return;
    setCreating(true);
    setDraftError("");
    setDraftResults([]);
    let offset = 0;
    try {
      while (offset < preview.posts.length) {
        const form = new FormData();
        form.set("clientId", client.id);
        form.set("file", file);
        form.set("confirm", "create_drafts");
        form.set("offset", String(offset));
        const response = await fetch("/api/calendar/bulk-drafts", {
          method: "POST", body: form,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to create drafts.");
        if (!Number.isInteger(data.nextOffset) || data.nextOffset <= offset) {
          throw new Error("The draft import did not advance. Check created drafts before retrying.");
        }
        setDraftResults((current) => [...current, ...data.results]);
        offset = data.nextOffset;
      }
    } catch (caught) {
      setDraftError((caught.message || "Draft creation was interrupted.") +
        " Retry with the same workbook and post_key values; completed rows are not duplicated.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className={styles.bulkPreviewSection} aria-labelledby="bulk-preview-heading">
      <h2 id="bulk-preview-heading">Bulk post preview</h2>
      {!client ? <p>Choose one client above to prepare a bulk upload.</p> : (
        <>
          <p>Prepare posts for <strong>{client.name}</strong> in {client.timezone}. Previewing only reads your workbook. Creating drafts requires a separate confirmation and never schedules or publishes.</p>
          <div>
            <a className={styles.bulkTemplateLink} href={`/api/calendar/bulk-preview?client=${encodeURIComponent(client.id)}&format=csv`}>Download CSV template</a>
            {" · "}
            <a className={styles.bulkTemplateLink} href={`/api/calendar/bulk-preview?client=${encodeURIComponent(client.id)}`}>Download .xlsx template</a>
            {" · "}
            <a className={styles.bulkTemplateLink} href={`/api/calendar/bulk-preview?client=${encodeURIComponent(client.id)}&format=csv&sample=1`}>CSV example</a>
          </div>
          <p>One row per Master post. CSV and Excel use identical columns: post_key, title, master_text, optional link_url or media_url, and local_date (YYYY-MM-DD) and local_time (HH:mm) as text. Put <strong>X</strong> in a connected account column to include it; leave it blank to skip. All selected accounts use that row’s release time. In CSV the client/account identity row is visible: leave row 2 unchanged. Replace every placeholder in the CSV example before uploading.</p>
          <p>A link without media gives Facebook and LinkedIn a link preview; Google Business will try its metadata-image fallback at draft import. The file preview does not fetch outside links or media.</p>
          {accounts.length ? <p>Template account columns: {accounts.map((account) => `${account.platform} · ${account.name}`).join(", ")}.</p> : <p>No connected accounts are saved for this client.</p>}
          <form onSubmit={submit} className={styles.bulkPreviewForm}>
            <label htmlFor="bulk-workbook">Bulk posts (.csv or .xlsx, up to 2 MB)</label>
            <input id="bulk-workbook" type="file" accept=".csv,.xlsx" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setError(""); setDraftResults([]); setDraftError(""); }} disabled={creating} />
            <button type="submit" disabled={loading || !accounts.length}>{loading ? "Checking…" : "Preview rows"}</button>
          </form>
          {error && <p className={styles.errorNotice} role="alert">{error}</p>}
        </>
      )}
      {preview && (
        <div aria-live="polite">
          <p className={preview.valid ? styles.successNotice : styles.errorNotice}>{preview.valid ? "All rows passed preview checks. Nothing has been saved yet." : "Some rows need correction. Nothing was saved."}</p>
          {preview.errors.map((message, index) => <p className={styles.errorNotice} key={index}>{message}</p>)}
          {preview.posts.map((post) => <article className={styles.bulkPostCard} key={post.row}>
            <h3>Row {post.row}: {post.title || post.post_key || "Untitled"}</h3>
            <p><strong>Key:</strong> {post.post_key || "Missing"}</p>
            <p className={styles.bulkText}>{post.master_text}</p>
            {post.link_url && <p><strong>Link:</strong> {post.link_url}</p>}
            {post.media_url && <p><strong>Media URL:</strong> {post.media_url}</p>}
            <p><strong>Release:</strong> {post.local_date || "date?"} {post.local_time || "time?"} {preview.client.timezone}</p>
            {post.errors.map((message, index) => <p className={styles.errorNotice} key={index}>{message}</p>)}
            <h4>Selected accounts</h4>
            {post.destinations.length ? <ul>{post.destinations.map((destination) => <li key={destination.account.id}>
              <strong>{destination.account.platform} · {destination.account.name}</strong> · {destination.mediaChoice}
              {destination.errors.map((message, index) => <p className={styles.errorNotice} key={index}>{message}</p>)}
            </li>)}</ul> : <p>No accounts selected for this post.</p>}
          </article>)}
          {preview.valid && <div>
            <p><strong>Next:</strong> Review the rows above, then confirm creation of drafts. Scheduling remains a separate step.</p>
            {!draftImportEnabled && <p className={styles.errorNotice}>Draft creation is staged but not enabled. The existing automated-test failures must be resolved and the full checks passed first.</p>}
            <button type="button" className={styles.button} disabled={!draftImportEnabled || creating || loading} onClick={createDrafts}>
              {creating ? "Creating drafts…" : "Confirm Create Drafts"}
            </button>
          </div>}
          {draftResults.length > 0 && <div aria-live="polite">
            <h3>Draft import results ({draftResults.length}/{preview.posts.length})</h3>
            <ul>{draftResults.map((result) => <li key={result.post_key}>
              <strong>Row {result.row}: {result.title}</strong> · {result.status === "created" ? "Created" :
                result.status === "existing" ? "Already created, verified" : "Needs attention"}
              {result.contentId && <> · <a href={"/content/" + result.contentId}>Open draft</a></>}
              {result.error && <p className={styles.errorNotice}>{result.error}</p>}
              {result.warning && <p>{result.warning}</p>}
            </li>)}</ul>
          </div>}
          {draftError && <p className={styles.errorNotice} role="alert">{draftError}</p>}
        </div>
      )}
    </section>
  );
}
