"use client";

import { useState } from "react";
import styles from "@/components/ui.module.css";

export default function CalendarBulkPreview({ client, accounts }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setPreview(null);
    setError("");
    if (!file) return setError("Choose a .xlsx workbook.");
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

  return (
    <section className={styles.bulkPreviewSection} aria-labelledby="bulk-preview-heading">
      <h2 id="bulk-preview-heading">Bulk post preview</h2>
      {!client ? <p>Choose one client above to prepare a bulk upload.</p> : (
        <>
          <p>Prepare posts for <strong>{client.name}</strong> in {client.timezone}. This step only reads your workbook. It does not create drafts or schedules.</p>
          <a className={styles.bulkTemplateLink} href={`/api/calendar/bulk-preview?client=${encodeURIComponent(client.id)}`}>Download .xlsx template</a>
          <p>One row per Master post. Add post_key, title, master_text, optional link_url or media_url, and local_date (YYYY-MM-DD) and local_time (HH:mm) as text. Put <strong>X</strong> in a connected account column to include it; leave it blank to skip. All selected accounts use that row’s release time.</p>
          <p>A link without media gives Facebook and LinkedIn a link preview; Google Business will try its metadata-image fallback at draft import. The file preview does not fetch outside links or media.</p>
          {accounts.length ? <p>Template account columns: {accounts.map((account) => `${account.platform} · ${account.name}`).join(", ")}.</p> : <p>No connected accounts are saved for this client.</p>}
          <form onSubmit={submit} className={styles.bulkPreviewForm}>
            <label htmlFor="bulk-workbook">Workbook (.xlsx, up to 2 MB)</label>
            <input id="bulk-workbook" type="file" accept=".xlsx" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setError(""); }} />
            <button type="submit" disabled={loading || !accounts.length}>{loading ? "Checking…" : "Preview rows"}</button>
          </form>
          {error && <p className={styles.errorNotice} role="alert">{error}</p>}
        </>
      )}
      {preview && (
        <div aria-live="polite">
          <p className={preview.valid ? styles.successNotice : styles.errorNotice}>{preview.valid ? "All rows passed preview checks. Draft import is the next build checkpoint; nothing was saved." : "Some rows need correction. Nothing was saved."}</p>
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
        </div>
      )}
    </section>
  );
}
