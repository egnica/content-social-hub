"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/ui.module.css";

export default function ContentDeleteFooter({ content, disabled = false }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  async function deleteContent() {
    if (disabled || deleting || !content?._id) return;
    if (!window.confirm(`Delete "${content.internalTitle}"?\n\nThis permanently deletes this content package. Published posts and uploaded media are kept.`)) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/content/${content._id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to delete the content package.");
      router.push("/content");
      router.refresh();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setDeleting(false);
    }
  }

  if (!content?._id) return null;
  return (
    <section className={styles.contentDeleteFooter} aria-label="Content management">
      <div className={styles.contentDeleteRow}>
        <div>
          <strong>Content management</strong>
          <p>Delete this content package. Published posts and uploaded media are kept.</p>
        </div>
        <button type="button" className={styles.buttonDanger} disabled={disabled || deleting} onClick={deleteContent}>
          {deleting ? "Deleting Content…" : "Delete Content"}
        </button>
      </div>
      {error ? <div ref={errorRef} className={styles.errorNotice} role="alert" tabIndex={-1}>{error}</div> : null}
    </section>
  );
}
