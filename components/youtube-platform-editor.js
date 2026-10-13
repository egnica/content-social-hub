"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import PlatformIcon from "@/components/platform-icon";
import styles from "@/components/ui.module.css";
import { youtubeThumbnailStatusLabel } from "@/lib/youtube-thumbnail-logic";
import { isYouTubeVersionOutOfSync, prepareYouTubeDescription, validateYouTubeVersionDraft } from "@/lib/platform-version-logic";

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
  const [publishing, setPublishing] = useState(false);
  const [publishState, setPublishState] = useState(initialVersion.lastPublishStatus || "");
  const [attempt, setAttempt] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [checkingThumbnail, setCheckingThumbnail] = useState(false);
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
    isShort: masterContent.contentLength !== "long", videoDuration: video?.duration,
    healthStatus: destination?.healthStatus || "unavailable",
    canPublish: destination?.canPublish === true,
  });
  const preparedDescription = prepareYouTubeDescription(form.description, form.chapters);
  async function reconcileUpload() {
    try {
      const response = await fetch(`/api/platform-versions/${version._id}/publish?statusOnly=1`, { cache: "no-store" });
      if (!response.ok) throw new Error("Upload status unavailable. Do not start another upload until it is checked.");
      const data = await response.json();
      setDiagnostics(data.diagnostics || null);
      if (data.attempt) {
        setAttempt(data.attempt);
        setPublishState(data.attempt.status);
      }
      if (data.platformVersion) setVersion(data.platformVersion);
      return data.attempt;
    } catch (cause) {
      setError(cause.message);
      setPublishState("unknown");
      return null;
    } finally { setStatusLoaded(true); }
  }
  async function checkYouTubeSession() {
    if (checkingSession || publishing) return;
    setCheckingSession(true);
    setError(""); setMessage("");
    try {
      const response = await fetch(`/api/platform-versions/${version._id}/youtube-session`, {
        method: "POST", cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "YouTube session check could not be completed.");
      setDiagnostics(data?.diagnostics || null);
      if (data?.attempt) {
        setAttempt(data.attempt);
        setPublishState(data.attempt.status);
      }
      setMessage("YouTube session check recorded. No video bytes were transferred. Review the result below.");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setCheckingSession(false);
    }
  }
  async function checkYouTubeThumbnail() {
    if (checkingThumbnail || publishing) return;
    setCheckingThumbnail(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/platform-versions/${version._id}/youtube-thumbnail`, {
        method: "POST", cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "YouTube thumbnail could not be checked.");
      setDiagnostics(data?.diagnostics || null);
      if (data?.attempt) {
        setAttempt(data.attempt);
        setPublishState(data.attempt.status);
      }
      setMessage("YouTube thumbnail metadata checked. Confirm the actual image in YouTube Studio.");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setCheckingThumbnail(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/platform-versions/${initialVersion._id}/publish?statusOnly=1`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Upload status unavailable. Starting another upload is blocked.");
        return response.json();
      }).then(data => {
        if (cancelled) return;
        setDiagnostics(data.diagnostics || null);
        if (data.attempt) { setAttempt(data.attempt); setPublishState(data.attempt.status); }
        if (data.platformVersion) setVersion(data.platformVersion);
      }).catch(cause => {
        if (!cancelled) { setError(cause.message); setPublishState("unknown"); }
      }).finally(() => { if (!cancelled) setStatusLoaded(true); });
    return () => { cancelled = true; };
  }, [initialVersion._id]);
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
  async function publishAction(resume = false) {
    if (!resume && !window.confirm("Upload this video to the selected YouTube channel using the chosen visibility and audience settings? This creates a real YouTube video.")) return;
    setPublishing(true); setError(""); setMessage("");
    try {
      // POST creates exactly one upload session. All later calls use GET to reconcile
      // that same session; the browser must never issue another create request.
      let method = resume ? "GET" : "POST";
      let previousOffset = -1;
      for (let step = 0; step < 100; step += 1) {
        const response = await fetch(`/api/platform-versions/${version._id}/publish`, {
          method, cache: "no-store",
        });
        method = "GET";
        const data = await response.json();
        if (data.attempt) {
          setAttempt(data.attempt);
          setPublishState(data.attempt.status);
        }
        if (data.platformVersion) setVersion(data.platformVersion);
        if (!response.ok) throw new Error(data.error || "YouTube upload needs review.");
        const current = data.attempt;
        if (!current) throw new Error("YouTube did not return the saved upload attempt.");
        if (current.status === "uploading") {
          if (Number(current.bytesUploaded || 0) === previousOffset) {
            throw new Error("Upload is not advancing. Saved session is preserved; check its status before continuing.");
          }
          previousOffset = Number(current.bytesUploaded || 0);
          setMessage("Transferring video to YouTube using the saved session…");
          continue;
        }
        if (current.status === "processing") {
          setMessage("Video bytes received by YouTube. Processing is pending; check status to finalize the thumbnail.");
          break;
        }
        if (current.status === "succeeded") {
          setMessage("YouTube processing complete. See the recorded video and thumbnail status.");
          break;
        }
        setMessage("Upload needs review. No duplicate upload will be started.");
        break;
      }
      await reconcileUpload();
      router.refresh();
    } catch (cause) {
      setError(cause.message);
      await reconcileUpload();
    } finally { setPublishing(false); }
  }
  return <section className={styles.platformEditor} data-platform="youtube">
    <div className={styles.sectionHeader}>
      <div className={styles.platformHeading}>
        <PlatformIcon platform="youtube" />
        <h2>YouTube · {version.destinationName || destination?.accountName || "Channel"}</h2>
      </div>
      <p>{version.customized ? "Customized for this channel" : "Using shared content"}</p>
    </div>
    <div className={styles.notice}>YouTube video publishing is available for real content. Upload uses resumable sessions; processing and custom thumbnails may require additional status checks. Scheduling is not enabled yet.</div>
    {error ? <div className={styles.errorNotice}>{error}</div> : null}
    {message ? <div className={styles.successNotice}>{message}</div> : null}
    {masterChanged ? <div className={styles.notice}>Master Content changed. Your YouTube-specific changes remain intact until you choose Update from Master.</div> : null}
    {validation.warnings.filter((item) => !item.startsWith("YouTube upload")).map((item) => <div key={item} className={styles.notice}>{item}</div>)}
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
            <span className={styles.fieldHint}>At least three ascending timestamps starting at 00:00, with each chapter at least 10 seconds long. Chapters will be appended to the description during publishing.</span>
          </label>
        </div>
        <div className={styles.notice} aria-live="polite">
          <strong>YouTube upload:</strong> {!statusLoaded ? "Checking saved status…" :
            !attempt && publishState !== "unknown" ? "Not started" :
            publishState === "unknown" ? "Status unavailable. New uploads disabled." :
            `${attempt?.status || publishState}${attempt?.bytesUploaded ? ` · ${(attempt.bytesUploaded / (video?.size || 1) * 100).toFixed(1)}% transferred` : ""}`}
          {attempt?.providerPostUrl ? <span> · <a href={attempt.providerPostUrl} target="_blank" rel="noreferrer">View on YouTube</a></span> : null}
          {attempt?.providerError ? <p>{typeof attempt.providerError === "string" ? attempt.providerError : attempt.providerError.message}</p> : null}
          {attempt?.videoThumbnailMediaAssetId || attempt?.thumbnailStatus ? (
            <p><strong>Custom thumbnail:</strong> {youtubeThumbnailStatusLabel(attempt)}.
              {" "}For Shorts, verify the actual image in YouTube Studio on a computer.
              {attempt.thumbnailError ? ` ${attempt.thumbnailError}` : ""}
            </p>
          ) : null}
        </div>
        <details className={styles.notice} style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Upload Diagnostics (read-only)</summary>
          <p className={styles.fieldHint}>
            Refresh diagnostics only reads the database. Check YouTube Session asks YouTube how many bytes it received, sends zero video bytes, and saves the result. Neither button starts or resumes an upload.
          </p>
          {diagnostics ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
              {[
                ["Attempt ID", diagnostics.attemptId || "Unknown"],
                ["Upload status", diagnostics.status],
                ["Saved session", diagnostics.sessionState],
                ["Recorded bytes", `${(diagnostics.recordedBytes || 0).toLocaleString()} / ${diagnostics.expectedBytes?.toLocaleString() ?? "Unknown"}`],
                ["Recorded progress", diagnostics.percentRecorded == null ? "Unknown" : `${diagnostics.percentRecorded}%`],
                ["Upload step", diagnostics.stepState],
                ["Step started", diagnostics.stepStartedAt ? new Date(diagnostics.stepStartedAt).toLocaleString() : "Not recorded"],
                ["Last updated", diagnostics.lastUpdatedAt ? new Date(diagnostics.lastUpdatedAt).toLocaleString() : "Unknown"],
                ["Video ID", diagnostics.videoId || "Not recorded"],
                ["YouTube processing", diagnostics.providerProcessingStatus || "Not checked / not recorded"],
                ["YouTube upload state", diagnostics.providerUploadStatus || "Not checked / not recorded"],
                ["Thumbnail", diagnostics.thumbnailLabel || "Not confirmed"],
              ].map(([label, value]) => <div key={label} style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                <strong style={{ display: "block" }}>{label}</strong>
                <span>{value}</span>
              </div>)}
            </div>
          ) : <p className={styles.fieldHint}>
            {statusLoaded ? "No saved attempt found, or diagnostics are unavailable." : "Checking for saved upload attempts…"}
          </p>}
          {diagnostics?.youtubeSessionCheck ? (
            <div style={{ marginTop: 12, padding: 12, border: "1px solid #b7c6bc", borderRadius: 8 }}>
              <strong>YouTube session check: {diagnostics.youtubeSessionCheck.result}</strong>
              <p className={styles.fieldHint}>
                Checked {diagnostics.youtubeSessionCheck.checkedAt ?
                  new Date(diagnostics.youtubeSessionCheck.checkedAt).toLocaleString() : "at an unknown time"}
                {diagnostics.youtubeSessionCheck.httpStatus ?
                  ` · HTTP ${diagnostics.youtubeSessionCheck.httpStatus}` : ""}
              </p>
              <p><strong>YouTube-confirmed bytes:</strong> {diagnostics.youtubeSessionCheck.confirmedBytes == null ?
                "Unknown" : diagnostics.youtubeSessionCheck.confirmedBytes.toLocaleString()}</p>
              {diagnostics.youtubeSessionCheck.videoId ?
                <p><strong>Session video ID:</strong> {diagnostics.youtubeSessionCheck.videoId}
                  {" · "}<a href={`https://www.youtube.com/watch?v=${diagnostics.youtubeSessionCheck.videoId}`}
                    target="_blank" rel="noreferrer">View on YouTube</a></p> : null}
              {diagnostics.youtubeSessionCheck.message ? <p>{diagnostics.youtubeSessionCheck.message}</p> : null}
              <p className={styles.fieldHint}>The session check does not update published status or send media.</p>
            </div>
          ) : <p className={styles.fieldHint}>YouTube session has not been checked by this diagnostic.</p>}
          {diagnostics?.thumbnailProviderCheck ? (
            <div style={{ marginTop: 12, padding: 12, border: "1px solid #b7c6bc", borderRadius: 8 }}>
              <strong>YouTube thumbnail readback: {diagnostics.thumbnailProviderCheck.result}</strong>
              <p className={styles.fieldHint}>
                Checked {diagnostics.thumbnailProviderCheck.checkedAt ?
                  new Date(diagnostics.thumbnailProviderCheck.checkedAt).toLocaleString() : "at an unknown time"}.
                This is a provider-reported thumbnail, not visual verification of your selected file.
              </p>
              {diagnostics.thumbnailProviderCheck.url ? (
                <div style={{ display: "flex", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <a href={diagnostics.thumbnailProviderCheck.url} target="_blank" rel="noreferrer">
                    <Image src={diagnostics.thumbnailProviderCheck.url} alt="Thumbnail currently reported by YouTube"
                      width={160} height={110} unoptimized style={{ maxWidth: 160, width: "auto", height: "auto", borderRadius: 6 }} />
                    <span style={{ display: "block" }}>View reported thumbnail</span>
                  </a>
                  <p className={styles.fieldHint} style={{ maxWidth: 280 }}>
                    Compare this with the selected thumbnail in the draft preview. YouTube may use a
                    generated frame or a different crop on Shorts surfaces.
                  </p>
                </div>
              ) : null}
              {diagnostics.thumbnailProviderCheck.message ? <p>{diagnostics.thumbnailProviderCheck.message}</p> : null}
            </div>
          ) : null}
          {diagnostics?.videoUrl ? <p><a href={diagnostics.videoUrl} target="_blank" rel="noreferrer">View recorded YouTube video</a></p> : null}
          {diagnostics?.lastError ? <p><strong>Last upload error:</strong> {diagnostics.lastError}</p> : null}
          {diagnostics?.thumbnailError ? <p><strong>Thumbnail error:</strong> {diagnostics.thumbnailError}</p> : null}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 }}>
            <button type="button" className={styles.buttonSecondary} disabled={publishing || checkingSession}
              onClick={() => reconcileUpload()}>Refresh diagnostics (database only)</button>
            <button type="button" className={styles.buttonSecondary}
              disabled={publishing || checkingSession || !statusLoaded || !diagnostics ||
                diagnostics.sessionState === "not saved"}
              onClick={checkYouTubeSession}>
              {checkingSession ? "Checking YouTube…" : "Check YouTube Session (no upload)"}
            </button>
            <button type="button" className={styles.buttonSecondary}
              disabled={publishing || checkingThumbnail || checkingSession || !diagnostics?.videoId}
              onClick={checkYouTubeThumbnail}>
              {checkingThumbnail ? "Checking thumbnail…" : "Check YouTube thumbnail (read-only)"}
            </button>
          </div>
        </details>
        <div className={styles.formActions} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className={styles.buttonSecondary} disabled={busy}
            onClick={() => { if ((dirty || version.customized) && !window.confirm("Replace YouTube edits with current Master Content?")) return;
              requestSave({ action: "reset_from_master" }, true); }}>Update from Master</button>
          <button type="button" className={styles.button} disabled={busy || !dirty || validation.blocking.length > 0}
            onClick={() => requestSave(form)}>{busy ? "Saving…" : dirty ? "Save YouTube Version" : "Saved"}</button>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
            {publishState === "succeeded" || version.lastPublishStatus === "succeeded" ? (
              version.providerPostUrl ? <a className={styles.button} href={version.providerPostUrl} target="_blank" rel="noreferrer">View YouTube Video</a> :
              <span>Published on YouTube</span>
            ) : publishState && publishState !== "failed" && publishState !== "unknown" && publishState !== "needs_review" && publishState !== "submitting" ? (
              <button type="button" className={styles.buttonSecondary} disabled={publishing || busy}
                onClick={() => publishAction(true)}>{publishing ? "Uploading / checking…" : "Continue upload / Check processing"}</button>
            ) : publishState === "unknown" || publishState === "needs_review" || publishState === "submitting" || publishState === "failed" ? (
              <button type="button" className={styles.buttonSecondary} disabled={publishing} onClick={reconcileUpload}>Refresh saved status</button>
            ) : (
              <button type="button" className={styles.button} disabled={!statusLoaded || publishing || busy || dirty || validation.blocking.length > 0}
                onClick={() => publishAction(false)}>{publishing ? "Starting upload…" : "Upload to YouTube"}</button>
            )}
          </div>
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
            <p className={styles.fieldHint}>Prepared description ({new TextEncoder().encode(preparedDescription.text).length}/5,000 UTF-8 bytes, including chapters)</p>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{preparedDescription.text}</p>
          </div>
        </div>
      </div>
    </div>
  </section>;
}
