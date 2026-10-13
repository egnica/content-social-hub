"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlatformIcon from "@/components/platform-icon";
import styles from "@/components/ui.module.css";
import { isYouTubeVersionOutOfSync, validateYouTubeVersionDraft } from "@/lib/platform-version-logic";

const toDraft = (version) => ({
  title: version.title || "",
  description: version.description || "",
  privacyStatus: version.privacyStatus || "private",
  madeForKids: typeof version.madeForKids === "boolean" ? version.madeForKids : null,
  mediaIds: (version.mediaIds || []).map(String),
  videoThumbnailMediaId: String(version.videoThumbnailMediaId || ""),
  chapters: version.chapters || "",
});

function YouTubeVideoPreview({ video, thumbnail, isShort }) {
  const [playing, setPlaying] = useState(false);
  const source = video?._id ? `/api/media/${video._id}/url` : "";
  const poster = thumbnail ? (thumbnail.previewUrl || `/api/media/${thumbnail._id}/url`) : "";
  return (
    <div style={{
      position: "relative", aspectRatio: isShort ? "9 / 16" : "16 / 9",
      width: isShort ? "min(100%, 260px)" : "100%", margin: "0 auto",
      background: "#151515", color: "#fff", overflow: "hidden",
      display: "grid", placeItems: "center",
    }}>
      {playing && source ? (
        <video src={source} poster={poster || undefined} controls autoPlay playsInline
          aria-label={video.originalName || "YouTube draft video"} preload="metadata"
          style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : video ? (
        <button type="button" onClick={() => setPlaying(true)}
          aria-label="Play video preview"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            border: 0, padding: 0, cursor: "pointer", color: "#fff",
            background: "#151515",
          }}>
          {poster ? <img src={poster} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> :
            <span style={{ display: "block", padding: 16 }}>{video.originalName || "Selected video"}</span>}
          <span aria-hidden="true" style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            background: "#e62117", borderRadius: 12, padding: "12px 21px",
            boxShadow: "0 2px 12px #0008", fontSize: 22,
          }}>▶</span>
        </button>
      ) : <span style={{ padding: 16, textAlign: "center" }}>Choose a Master video</span>}
    </div>
  );
}

export function YouTubeVersionEditor({ initialVersion, destination, masterContent }) {
  const router = useRouter();
  const [version, setVersion] = useState(initialVersion);
  const [form, setForm] = useState(() => toDraft(initialVersion));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const media = masterContent.media || [];
  const videos = media.filter((a) => String(a.contentType || "").startsWith("video/"));
  const thumbnailOptions = [
    ...(masterContent.defaultVideoThumbnail ? [masterContent.defaultVideoThumbnail] : []),
    ...media,
    ...(version.videoThumbnail ? [version.videoThumbnail] : []),
  ].filter((a, i, arr) => a && ["image/jpeg", "image/png"].includes(a.contentType) &&
    arr.findIndex((candidate) => String(candidate?._id) === String(a._id)) === i);
  const thumbnail = thumbnailOptions.find((a) => String(a._id) === form.videoThumbnailMediaId);
  const video = videos.find((a) => form.mediaIds.includes(String(a._id)));
  const masterChanged = isYouTubeVersionOutOfSync(version, masterContent.revision);
  const validation = validateYouTubeVersionDraft({
    ...form, media, thumbnail, masterChanged, customized: version.customized,
    healthStatus: destination?.healthStatus || "unavailable",
    canPublish: destination?.canPublish === true,
  });
  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true); setError(""); setMessage("");
  }
  async function requestSave(payload, reset = false) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/platform-versions/${version._id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save YouTube draft.");
      setVersion(data.platformVersion);
      setForm(toDraft(data.platformVersion));
      setDirty(false);
      setMessage(reset ? "YouTube draft updated from Master Content." : "YouTube draft saved. Nothing was published.");
      router.refresh();
    } catch (cause) {
      setError(cause.message);
    } finally { setBusy(false); }
  }
  return <section className={styles.platformEditor} data-platform="youtube">
    <div className={styles.sectionHeader}>
      <div className={styles.platformHeading}>
        <PlatformIcon platform="youtube" />
        <h2>YouTube · {version.destinationName || destination?.accountName || "Channel"}</h2>
      </div>
      <p>{version.customized ? "Customized for this channel" : "Using shared content"}</p>
    </div>
    <div className={styles.notice}>Draft editor only. YouTube upload, processing, thumbnails submission, Publish Now, and scheduling will be added in later tasks. Saving here does not upload anything.</div>
    {error ? <div className={styles.errorNotice}>{error}</div> : null}
    {message ? <div className={styles.successNotice}>{message}</div> : null}
    {masterChanged ? <div className={styles.notice}>Master Content changed. Your YouTube-specific changes remain intact until you choose Update from Master.</div> : null}
    {validation.blocking.length ? <div className={styles.errorNotice}><strong>Draft validation</strong>
      <ul>{validation.blocking.map((item) => <li key={item}>{item}</li>)}</ul></div> :
      <div className={styles.editorReady}>{dirty ? "Unsaved changes" : "Valid saved draft"}</div>}
    <div className={styles.composerColumns}>
      <div>
        <div className={styles.fieldGrid}>
          <label className={styles.fieldFull}><span className={styles.label}>YouTube title ({form.title.length}/100)</span>
            <input className={styles.input} value={form.title} onChange={(e) => update("title", e.target.value)} maxLength={120}/></label>
          <label className={styles.fieldFull}><span className={styles.label}>Description (5,000 UTF-8 bytes max)</span>
            <textarea className={styles.textarea} value={form.description} rows={7} onChange={(e) => update("description", e.target.value)}/></label>
          <label className={styles.fieldFull}><span className={styles.label}>Video from Master Content</span>
            <select className={styles.input} value={form.mediaIds[0] || ""} onChange={(e) => update("mediaIds", e.target.value ? [e.target.value] : [])}>
              <option value="">Choose one video</option>
              {videos.map((asset) => <option key={asset._id} value={String(asset._id)}>{asset.originalName || "Video"}</option>)}
            </select></label>
          <label className={styles.fieldFull}><span className={styles.label}>Visibility</span>
            <select className={styles.input} value={form.privacyStatus} onChange={(e) => update("privacyStatus", e.target.value)}>
              <option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option>
            </select></label>
          <label className={styles.fieldFull}><span className={styles.label}>Audience declaration</span>
            <select className={styles.input} value={form.madeForKids === null ? "" : String(form.madeForKids)}
              onChange={(e) => update("madeForKids", e.target.value === "" ? null : e.target.value === "true")}>
              <option value="">Choose an audience</option><option value="false">No, not made for kids</option><option value="true">Yes, made for kids</option>
            </select></label>
          <label className={styles.fieldFull}><span className={styles.label}>Custom thumbnail (optional)</span>
            <select className={styles.input} value={form.videoThumbnailMediaId} onChange={(e) => update("videoThumbnailMediaId", e.target.value)}>
              <option value="">No custom thumbnail</option>
              {thumbnailOptions.map((asset) => <option key={asset._id} value={String(asset._id)}>{asset.originalName || "Thumbnail"}</option>)}
            </select></label>
          <label className={styles.fieldFull}><span className={styles.label}>Manual chapters (optional)</span>
            <textarea className={styles.textarea} rows={5} value={form.chapters} placeholder={"00:00 Intro\n00:30 Main section\n01:20 Wrap-up"}
              onChange={(e) => update("chapters", e.target.value)} />
            <span className={styles.fieldHint}>At least three ascending timestamps, first at 00:00, each separated by at least 10 seconds. Added to the description during the later publishing task.</span>
          </label>
        </div>
        <div className={styles.formActions}>
          <button type="button" className={styles.buttonSecondary} disabled={busy}
            onClick={() => { if ((dirty || version.customized) && !window.confirm("Replace YouTube edits with current Master Content?")) return;
              requestSave({ action: "reset_from_master" }, true); }}>Update from Master</button>
          <button type="button" className={styles.button} disabled={busy || !dirty || validation.blocking.length > 0}
            onClick={() => requestSave(form)}>{busy ? "Saving…" : dirty ? "Save YouTube Version" : "Saved"}</button>
        </div>
      </div>
      <div>
        <div className={styles.sectionHeader}><h2>YouTube Preview</h2><p>{masterContent.contentLength === "long" ? "16:9 video" : "9:16 Short"} · Play local draft preview, not a YouTube upload</p></div>
        <div style={{ border: "1px solid #d8dde3", borderRadius: 12, overflow: "hidden" }}>
          <YouTubeVideoPreview key={`${video?._id || "none"}-${thumbnail?._id || "none"}-${masterContent.contentLength}`}
            video={video} thumbnail={thumbnail} isShort={masterContent.contentLength !== "long"} />
          <div style={{ padding: 16 }}>
            <strong style={{ overflowWrap: "anywhere" }}>{form.title || "YouTube title"}</strong>
            <p className={styles.fieldHint}>{destination?.accountName || "YouTube Channel"} · {form.privacyStatus}</p>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{form.description}</p>
            {form.chapters ? <pre style={{ whiteSpace: "pre-wrap" }}>{form.chapters}</pre> : null}
          </div>
        </div>
      </div>
    </div>
  </section>;
}
