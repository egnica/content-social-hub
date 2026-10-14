"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import PlatformIcon from "@/components/platform-icon";
import DestinationScheduleControls from "@/components/facebook-schedule-controls";
import DestinationPublishingPanel from "@/components/destination-publishing-panel";
import PublishedPostSummary from "@/components/published-post-summary";
import YouTubeFramePicker from "@/components/youtube-frame-picker";
import styles from "@/components/ui.module.css";
import youtubeStyles from "./youtube-editor.module.css";
import { youtubeThumbnailStatusLabel } from "@/lib/youtube-thumbnail-logic";
import { parseYouTubeTags } from "@/lib/youtube-metadata-defaults";
import { isYouTubeVersionOutOfSync, prepareYouTubeDescription, validateYouTubeVersionDraft } from "@/lib/platform-version-logic";

const toDraft = (version) => ({
  title: version.title || "",
  description: version.description || "",
  privacyStatus: version.privacyStatus || "private",
  madeForKids: typeof version.madeForKids === "boolean" ? version.madeForKids : null,
  mediaIds: (version.mediaIds || []).map(String),
  videoThumbnailMediaId: String(version.videoThumbnailMediaId || ""),
  chapters: version.chapters || "",
  playlistIds: version.playlistIds || [],
  paidPromotion: version.paidPromotion ?? false,
  containsSyntheticMedia: version.containsSyntheticMedia ?? false,
  defaultLanguage: version.defaultLanguage ?? "en",
  captionCertification: version.captionCertification ?? "never_aired_us",
  tagsText: (version.tags || []).join(", "),
  recordingDate: version.recordingDate || "",
  recordingLocation: version.recordingLocation || "",
});

function YouTubeVideoPreview({ video, thumbnail, isShort }) {
  const [playing, setPlaying] = useState(false);
  const source = video?._id ? `/api/media/${video._id}/url` : "";
  const poster = thumbnail ? (thumbnail.previewUrl || `/api/media/${thumbnail._id}/url`) : "";
  return (
    <div className={isShort ? youtubeStyles.shortPreview : undefined} style={{
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
          {poster ? <Image src={poster} alt="" width={isShort ? 260 : 640} height={isShort ? 462 : 360} unoptimized style={{ width: "100%", height: "100%", objectFit: "contain" }} /> :
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
  const [capturedThumbnail, setCapturedThumbnail] = useState(null);
  const [showFramePicker, setShowFramePicker] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistError, setPlaylistError] = useState("");
  const [playlistCanManage, setPlaylistCanManage] = useState(false);
  const [playlistReconnectUrl, setPlaylistReconnectUrl] = useState("");
  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [newPlaylistPrivacy, setNewPlaylistPrivacy] = useState("private");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [assigningPlaylist, setAssigningPlaylist] = useState(false);
  const [playlistMessage, setPlaylistMessage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isShort = masterContent.contentLength !== "long";
  const uploaded = publishState === "succeeded" || version.lastPublishStatus === "succeeded" || version.status === "published";
  const uploadActive = ["uploading", "processing", "submitting"].includes(publishState);
  const needsReview = ["needs_review", "unknown", "failed"].includes(publishState);
  const editingLocked = !statusLoaded || busy || publishing || uploaded || uploadActive || needsReview;
  const videoId = attempt?.providerVideoId || version.providerPostId;
  const studioUrl = /^[A-Za-z0-9_-]{11}$/.test(String(videoId || ""))
    ? `https://studio.youtube.com/video/${videoId}/edit` : "https://studio.youtube.com/";
  const videoUrl = attempt?.providerPostUrl || version.providerPostUrl;
  const media = masterContent.media || [];
  const videos = media.filter((a) => String(a.contentType || "").startsWith("video/"));
  const thumbnailOptions = [
    ...(masterContent.defaultVideoThumbnail ? [masterContent.defaultVideoThumbnail] : []),
    ...media,
    ...(version.videoThumbnail ? [version.videoThumbnail] : []),
    ...(capturedThumbnail ? [capturedThumbnail] : []),
  ].filter((a, i, arr) => a && ["image/jpeg", "image/png"].includes(a.contentType) &&
    arr.findIndex((candidate) => String(candidate?._id) === String(a._id)) === i);
  const thumbnail = thumbnailOptions.find((a) => String(a._id) === form.videoThumbnailMediaId);
  const video = videos.find((a) => form.mediaIds.includes(String(a._id)));
  const progress = video?.size ? Math.min(100, Math.max(0, Math.round(100 * Number(attempt?.bytesUploaded || 0) / video.size))) : 0;
  const masterChanged = isYouTubeVersionOutOfSync(version, masterContent.revision);
  const metadataDraft = { ...form, videoThumbnailMediaId: isShort ? "" : form.videoThumbnailMediaId, tags: parseYouTubeTags(form.tagsText) };
  const validation = validateYouTubeVersionDraft({
    ...metadataDraft, media, thumbnail, masterChanged, customized: version.customized,
    isShort, videoDuration: video?.duration,
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
  const loadPlaylists = useCallback(async () => {
    setPlaylistsLoading(true); setPlaylistError("");
    try {
      const response = await fetch(`/api/platform-versions/${version._id}/playlists`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load channel playlists.");
      setPlaylists(data.playlists || []);
      setPlaylistCanManage(data.canManage === true);
      setPlaylistReconnectUrl(data.reconnectUrl || "");
    } catch (cause) { setPlaylistError(cause.message); }
    finally { setPlaylistsLoading(false); }
  }, [version._id]);
  useEffect(() => {
    const timer = setTimeout(() => { void loadPlaylists(); }, 0);
    return () => clearTimeout(timer);
  }, [loadPlaylists]);
  async function createPlaylist() {
    if (!playlistCanManage || !newPlaylistTitle.trim()) return;
    if (!window.confirm(`Create a ${newPlaylistPrivacy} YouTube playlist named "${newPlaylistTitle.trim()}" on this channel?`)) return;
    setCreatingPlaylist(true); setPlaylistError(""); setPlaylistMessage("");
    try {
      const response = await fetch(`/api/platform-versions/${version._id}/playlists`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: newPlaylistTitle.trim(), privacyStatus: newPlaylistPrivacy }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Playlist creation could not be confirmed. Refresh the list before retrying.");
      const created = data.playlist;
      setPlaylists((current) => [...current.filter(item => item.id !== created.id), created]);
      update("playlistIds", [...new Set([...(form.playlistIds || []), created.id])]);
      setNewPlaylistTitle("");
      setPlaylistMessage("Playlist created and selected. Save the YouTube draft to keep this selection.");
    } catch (cause) { setPlaylistError(cause.message); }
    finally { setCreatingPlaylist(false); }
  }
  async function applyPlaylistsToVideo() {
    if (dirty) { setPlaylistError("Save the YouTube draft before attaching playlists."); return; }
    setAssigningPlaylist(true); setPlaylistError(""); setPlaylistMessage("");
    try {
      const response = await fetch(`/api/platform-versions/${version._id}/playlists`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attach" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Playlist attachment was not confirmed.");
      setPlaylistMessage(data.status === "added" ? "Video is in the selected playlists." :
        data.status === "needs_reconnect" ? "Reconnect YouTube for playlist management." :
        data.status === "none" ? "No playlists were selected." :
        "Playlist attachment requires review. No duplicate video upload occurred.");
    } catch (cause) { setPlaylistError(cause.message); }
    finally { setAssigningPlaylist(false); }
  }
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
      setMessage(reset ? "YouTube draft updated from Master Content." : uploaded
        ? "Playlist selection saved. Use Apply playlists to update the uploaded video."
        : "YouTube draft saved. Nothing was published.");
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
  const videoDetails = (
    <details className={styles.editorContentDetails} open={!uploaded}>
      <summary>{uploaded || isShort ? "Video details" : "Video details and thumbnail"}</summary>
<section className={youtubeStyles.contentCard} aria-label="Video content">
    <fieldset className={youtubeStyles.coreFields} disabled={editingLocked}>
      <legend className={youtubeStyles.srOnly}>Video details</legend>
      <label className={styles.fieldFull}><span className={styles.label}>Video</span>
            <select className={styles.input} value={form.mediaIds[0] || ""} onChange={(e) => update("mediaIds", e.target.value ? [e.target.value] : [])}>
              <option value="">Choose one video</option>
              {videos.map((asset) => <option key={asset._id} value={String(asset._id)}>{asset.originalName || "Video"}</option>)}
            </select></label>
      <label className={styles.fieldFull}><span className={styles.label}>Title <small>{form.title.length}/100</small></span>
            <input className={styles.input} value={form.title} onChange={(e) => update("title", e.target.value)} maxLength={100}/></label>
      <label className={styles.fieldFull}><span className={styles.label}>Description</span>
            <textarea className={styles.textarea} value={form.description} rows={5} onChange={(e) => update("description", e.target.value)}/></label>
      {!isShort ? <>
      <label className={styles.fieldFull}><span className={styles.label}>Custom thumbnail (optional)</span>
            <select className={styles.input} value={form.videoThumbnailMediaId} onChange={(e) => update("videoThumbnailMediaId", e.target.value)}>
              <option value="">No custom thumbnail</option>
              {thumbnailOptions.map((asset) => <option key={asset._id} value={String(asset._id)}>{asset.originalName || "Thumbnail"}</option>)}
            </select></label>
      <div style={{ display: "grid", gap: 9 }}>
        <button type="button" className={styles.buttonSecondary} disabled={!video || busy || publishing}
          onClick={() => setShowFramePicker(open => !open)}>
          {showFramePicker ? "Close image capture" : "Create thumbnail image from video"}
        </button>
        {showFramePicker && video ? <YouTubeFramePicker key={String(video._id)} video={video}
          clientId={String(masterContent.clientId)} isShort={false}
          disabled={editingLocked}
          onSelected={asset => {
            setCapturedThumbnail(asset);
            update("videoThumbnailMediaId", String(asset._id));
            setShowFramePicker(false);
            setMessage("Thumbnail image created. Save the draft to use it for your next upload.");
          }} /> : null}
      </div>
      </> : <div className={youtubeStyles.thumbnailNote}>
        <strong>Shorts thumbnail</strong>
        <p>After uploading, choose a frame in the YouTube mobile app. Custom thumbnail images are not sent for Shorts from this hub.</p>
      </div>}
    </fieldset>
  </section>
<section className={youtubeStyles.publishingCard} aria-label="Publishing options">
    <h3 className={youtubeStyles.sectionTitle}>Visibility &amp; audience</h3>
    <fieldset className={youtubeStyles.publishFields} disabled={editingLocked}>
      <legend className={youtubeStyles.srOnly}>Visibility and audience</legend>
      <label className={styles.fieldFull}><span className={styles.label}>Visibility</span>
            <select className={styles.input} value={form.privacyStatus} onChange={(e) => update("privacyStatus", e.target.value)}>
              <option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option>
            </select></label>
      <label className={styles.fieldFull}><span className={styles.label}>Audience declaration</span>
            <select className={styles.input} value={form.madeForKids === null ? "" : String(form.madeForKids)}
              onChange={(e) => update("madeForKids", e.target.value === "" ? null : e.target.value === "true")}>
              <option value="">Choose an audience</option><option value="false">No, not made for kids</option><option value="true">Yes, made for kids</option>
            </select></label>
    </fieldset>
  </section>
<details className={`${styles.editorContentDetails} ${youtubeStyles.advancedCard}`}>
          <summary className={youtubeStyles.sectionSummary}><span>Additional settings</span><small>Tags, language, disclosures, chapters &amp; recording details</small></summary>
          <p className={styles.fieldHint}>These fields use your defaults. Change them only when needed.</p>
          <fieldset className={youtubeStyles.advancedFields} disabled={editingLocked}>
            <legend className={youtubeStyles.srOnly}>Additional video settings</legend>
            <label className={styles.fieldFull}><span className={styles.label}>Paid promotion</span>
              <select className={styles.input} value={String(form.paidPromotion)} onChange={(e) => update("paidPromotion", e.target.value === "true")}>
                <option value="false">No (default)</option><option value="true">Yes</option>
              </select>
              <span className={styles.fieldHint}>Saved in Content Social Hub; verify sponsorship disclosure in YouTube Studio when Yes.</span>
            </label>
            <label className={styles.fieldFull}><span className={styles.label}>Realistic altered or synthetic content disclosure</span>
              <select className={styles.input} value={String(form.containsSyntheticMedia)} onChange={(e) => update("containsSyntheticMedia", e.target.value === "true")}>
                <option value="false">No (default)</option><option value="true">Yes</option>
              </select>
              <span className={styles.fieldHint}>Use Yes when YouTube requires disclosure of realistic synthetic or altered material, not for every AI-assisted workflow.</span>
            </label>
            <label className={styles.fieldFull}><span className={styles.label}>Video metadata language</span>
              <select className={styles.input} value={form.defaultLanguage} onChange={(e) => update("defaultLanguage", e.target.value)}>
                <option value="en">English (default)</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option>
              </select>
            </label>
            <label className={styles.fieldFull}><span className={styles.label}>Caption certification</span>
              <select className={styles.input} value={form.captionCertification} onChange={(e) => update("captionCertification", e.target.value)}>
                <option value="never_aired_us">This content has never aired on television in the U.S. (default)</option>
                <option value="unspecified">Not specified</option>
              </select>
              <span className={styles.fieldHint}>Saved in the app. The YouTube Data API does not publish this Studio certification field.</span>
            </label>
            <label className={styles.fieldFull}><span className={styles.label}>Tags (comma-separated)</span>
              <textarea rows={2} className={styles.textarea} value={form.tagsText} placeholder="SEO, video, tutorial"
                onChange={(e) => update("tagsText", e.target.value)}/>
            </label>
            <label className={styles.fieldFull}><span className={styles.label}>Recording date (optional)</span>
              <input className={styles.input} type="date" value={form.recordingDate}
                onChange={(e) => update("recordingDate", e.target.value)}/>
            </label>
            <label className={styles.fieldFull}><span className={styles.label}>Recording location (optional)</span>
              <input className={styles.input} type="text" maxLength={200} value={form.recordingLocation}
                placeholder="e.g. Minneapolis, MN" onChange={(e) => update("recordingLocation", e.target.value)}/>
              <span className={styles.fieldHint}>Saved in the hub only; update the location in YouTube Studio if needed.</span>
            </label>
            <div className={styles.fieldFull}>
              <span className={styles.label}>Upload date</span>
              <p className={styles.fieldHint}>{attempt?.startedAt ? new Date(attempt.startedAt).toLocaleString() : "Automatically recorded when upload begins."}</p>
            </div>

            <div className={youtubeStyles.chapterField}><label className={styles.fieldFull}><span className={styles.label}>Manual chapters (optional)</span>
            <textarea className={styles.textarea} rows={5} value={form.chapters} placeholder={"00:00 Intro\n00:30 Main section\n01:20 Wrap-up"}
              onChange={(e) => update("chapters", e.target.value)} />
            <span className={styles.fieldHint}>At least three ascending timestamps starting at 00:00, with each chapter at least 10 seconds long. Chapters will be appended to the description during publishing.</span>
          </label></div>
          </fieldset>

        </details>
    </details>
  );
  const videoPreview = (
<div className={youtubeStyles.previewCard}>
        {!uploaded ? <div className={styles.sectionHeader}><h2>YouTube Preview</h2><p>Approximate preview only. YouTube controls final rendering.</p></div> : null}
        <div style={{ border: "1px solid #d8dde3", borderRadius: 12, overflow: "hidden" }}>
          <YouTubeVideoPreview key={`${video?._id || "none"}-${thumbnail?._id || "none"}-${masterContent.contentLength}`}
            video={video} thumbnail={isShort ? null : thumbnail} isShort={isShort} />
          <div style={{ padding: 16 }}>
            <strong style={{ overflowWrap: "anywhere" }}>{form.title || "YouTube title"}</strong>
            <p className={styles.fieldHint}>{destination?.accountName || "YouTube Channel"} · {form.privacyStatus}</p>
            <p className={styles.fieldHint}>Description · {new TextEncoder().encode(preparedDescription.text).length.toLocaleString()}/5,000 bytes</p>
            <p className={youtubeStyles.previewExcerpt} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{preparedDescription.text}</p>
          </div>
        </div>
</div>
  );
  const playlistOptions = (
    <>
<details className={`${styles.editorContentDetails} ${youtubeStyles.playlistDisclosure}`}>
      <summary className={youtubeStyles.sectionSummary}>
        <span>Playlists</span>
        <small>{form.playlistIds.length} selected · Choose or create</small>
      </summary>
      <div className={youtubeStyles.playlistInner}>

          <div className={youtubeStyles.playlistChoices}>
            <p className={styles.fieldHint}>Choose from this channel</p>
            {playlistsLoading ? <p>Loading channel playlists…</p> : playlists.length ? (
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {playlists.map((playlist) => (
                  <label key={playlist.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" disabled={busy || publishing || uploadActive || needsReview || !statusLoaded} checked={form.playlistIds.includes(playlist.id)}
                      onChange={(e) => update("playlistIds", e.target.checked ?
                        [...new Set([...form.playlistIds, playlist.id])] :
                        form.playlistIds.filter((id) => id !== playlist.id))} />
                    <span>{playlist.title} <small>({playlist.privacyStatus})</small></span>
                  </label>
                ))}
              </div>
            ) : <p className={styles.fieldHint}>No playlists loaded for this channel yet.</p>}
          </div>
          {form.playlistIds.length ? <p className={styles.fieldHint}>Selected: {form.playlistIds.map(id => playlists.find(p => p.id === id)?.title || id).join(", ")}</p> : null}
          <button type="button" className={styles.buttonSecondary} disabled={playlistsLoading} onClick={loadPlaylists}>Refresh playlists</button>
          {playlistCanManage ? (
            <details className={youtubeStyles.createPlaylist}>
              <summary>+ Create playlist</summary>
              <div className={youtubeStyles.createPlaylistControls}>
              <label><span className={styles.label}>Create playlist</span>
                <input className={styles.input} value={newPlaylistTitle} maxLength={150}
                  placeholder="New playlist title" onChange={(e) => setNewPlaylistTitle(e.target.value)} /></label>
              <select className={styles.input} aria-label="New playlist visibility" value={newPlaylistPrivacy}
                onChange={(e) => setNewPlaylistPrivacy(e.target.value)}>
                <option value="private">Private</option><option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
              <button type="button" className={styles.buttonSecondary}
                disabled={creatingPlaylist || !newPlaylistTitle.trim()}
                onClick={createPlaylist}>{creatingPlaylist ? "Creating…" : "+ Create Playlist"}</button>
              </div>
            </details>
          ) : <p className={styles.fieldHint}>Reconnect this channel to enable playlist management.
            {playlistReconnectUrl ? <> <a href={playlistReconnectUrl}>Reconnect YouTube for playlist access</a>.</> : null}
            Existing video uploading remains available without this extra permission.
          </p>}
          {playlistError ? <div className={styles.errorNotice}>{playlistError}</div> : null}
          {playlistMessage ? <p className={styles.fieldHint}>{playlistMessage}</p> : null}
      {uploaded && dirty ? <div className={styles.formActions}>
        <button type="button" className={styles.button} disabled={busy || publishing || !statusLoaded || uploadActive || needsReview || validation.blocking.length > 0}
          onClick={() => requestSave(metadataDraft)}>{busy ? "Saving…" : "Save playlist selection"}</button>
      </div> : null}
          {(publishState === "succeeded" || version.lastPublishStatus === "succeeded") ?
            <button type="button" className={styles.buttonSecondary}
              disabled={assigningPlaylist || dirty || !playlistCanManage}
              onClick={applyPlaylistsToVideo}>{assigningPlaylist ? "Applying playlists…" : "Apply playlists to uploaded video"}</button> : null}
      </div>
    </details>

    </>
  );
  const uploadDetails = (
    <>
{attempt || needsReview ? <details className={youtubeStyles.diagnostics}>
          <summary className={youtubeStyles.diagnosticSummary}>Troubleshooting &amp; upload details</summary>
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
        </details> : null}
    </>
  );
  const uploadControls = (
    <>
<div className={youtubeStyles.uploadStatus} aria-live="polite">
          <strong>{!statusLoaded ? "Checking your saved upload…" : uploaded ? "Video uploaded successfully" :
            publishState === "unknown" ? "We could not check this upload" : publishState === "uploading" ? `Uploading video · ${progress}%` :
            publishState === "processing" ? "YouTube is processing your video" : publishState === "submitting" ? "Starting your upload" :
            needsReview ? "This upload needs attention" : dirty ? "Save your changes to continue" : "Draft saved"}</strong>
          <p>{uploaded ? `Check the video in YouTube Studio. ${isShort ? "Choose its thumbnail frame in the YouTube mobile app." : "Confirm the custom thumbnail there."}` :
            uploadActive ? "Your existing upload is saved. Continue it here without creating another video." :
            needsReview ? "Refresh the saved status, then use troubleshooting below. A new upload is blocked until this attempt is reviewed." :
            "Save your video details, then choose Upload now or Schedule."}</p>
          {publishState === "uploading" ? <progress className={youtubeStyles.progress} value={progress} max={100} aria-label="Video upload progress" /> : null}
          {!isShort && (attempt?.videoThumbnailMediaAssetId || attempt?.thumbnailStatus) ? (
            <p><strong>Custom thumbnail:</strong> {youtubeThumbnailStatusLabel(attempt)}.
              {attempt.thumbnailError ? ` ${attempt.thumbnailError}` : ""}
            </p>
          ) : null}
        </div>
      <div className={styles.formActions}>
        {uploadActive && publishState !== "submitting" ? (
          <button type="button" className={styles.button} disabled={publishing || busy}
            onClick={() => publishAction(true)}>{publishing ? "Working…" : publishState === "uploading" ? "Continue upload" : "Check processing"}</button>
        ) : needsReview || publishState === "submitting" ? (
          <button type="button" className={styles.buttonSecondary} disabled={publishing || busy}
            onClick={reconcileUpload}>Refresh saved status</button>
        ) : (
          <button type="button" className={styles.button} disabled={!statusLoaded || publishing || busy || dirty || validation.blocking.length > 0}
            onClick={() => publishAction(false)}>{publishing ? "Starting upload…" : "Upload to YouTube"}</button>
        )}
      </div>
      {dirty ? <p className={styles.fieldHint}>Save the draft before uploading.</p> : null}
      {uploadDetails}
    </>
  );
  const accountName = version.destinationName || destination?.accountName || "YouTube Channel";
  return (
    <section className={styles.platformEditor} data-platform="youtube" data-published={uploaded}>
      {!uploaded ? <div className={styles.sectionHeader}>
        <div className={styles.platformHeading}><PlatformIcon platform="youtube" /><h2>YouTube · {accountName}</h2></div>
        <p>{version.customized ? "Customized for this account" : "Using shared content"} · {isShort ? "Short" : "Standard video"}</p>
      </div> : null}
      {error ? <div className={styles.errorNotice} role="alert">{error}</div> : null}
      {message ? <div className={styles.successNotice} role="status">{message}</div> : null}
      {masterChanged && !uploaded ? <div className={styles.notice}>Master Content changed. Your YouTube draft is preserved until you choose Update from Master.</div> : null}
      {!uploaded && validation.blocking.length && !uploadActive ? <div className={styles.errorNotice}>
        <strong>Complete these details before uploading</strong>
        <ul>{validation.blocking.map(item => <li key={item}>{item}</li>)}</ul>
      </div> : !uploaded ? <div className={styles.editorReady}>
        {!statusLoaded ? "Checking saved status…" : uploadActive ? "Upload in progress" : needsReview ? "Needs attention" : dirty ? "Unsaved changes" : "Saved draft"}
      </div> : null}
      {!uploaded ? validation.warnings.filter(item => !item.startsWith("YouTube upload") && !item.startsWith("Master changed")).map(item => <div key={item} className={styles.notice}>{item}</div>) : null}
      {!uploaded ? <div className={styles.composerColumns}>
        <div>
          {videoDetails}
          {playlistOptions}
          <div className={styles.formActions}>
            <button type="button" className={styles.buttonSecondary} disabled={editingLocked}
              onClick={() => { if ((dirty || version.customized) && !window.confirm("Replace YouTube edits with current Master Content?")) return;
                requestSave({ action: "reset_from_master" }, true); }}>Update from Master</button>
            <button type="button" className={styles.button} disabled={busy || publishing || !statusLoaded || !dirty || uploadActive || needsReview || validation.blocking.length > 0}
              onClick={() => requestSave(metadataDraft)}>{busy ? "Saving…" : dirty ? "Save YouTube Version" : "Saved"}</button>
          </div>
        </div>
        {videoPreview}
      </div> : null}
      <DestinationPublishingPanel published={uploaded} attention={uploadActive || needsReview}
        destinationName={accountName} nowLabel="Upload now"
        schedule={!uploaded ? <>
          <p className={styles.fieldHint}>Uploading begins at the scheduled time. YouTube processing may delay when the video becomes available.</p>
          <DestinationScheduleControls version={version} destination={destination} masterContent={masterContent}
            dirty={dirty} busy={busy || publishing || uploadActive || needsReview || !statusLoaded} />
        </> : null}
        publish={uploaded ? <>
          <PublishedPostSummary platformLabel="YouTube" destinationName={accountName} version={version} attempt={attempt}
            postUrl={videoUrl} timezone={masterContent.clientTimezone} resultLabel="Uploaded" postLabel="View YouTube video ↗"
            extraActions={<a className={styles.buttonSecondary} href={studioUrl} target="_blank" rel="noreferrer">Open Studio</a>} />
          <p className={youtubeStyles.resultHint}>Video details are read-only here. Edit them in Studio. {isShort ? "Choose the thumbnail frame in the YouTube mobile app." : "Confirm the thumbnail in Studio."}</p>
          {!isShort && (attempt?.videoThumbnailMediaAssetId || attempt?.thumbnailStatus) ?
            <p className={youtubeStyles.resultHint}><strong>Custom thumbnail:</strong> {youtubeThumbnailStatusLabel(attempt)}.
              {attempt.thumbnailError ? ` ${attempt.thumbnailError}` : ""}
            </p> : null}
          <div className={styles.publishedPreview}>{videoPreview}</div>
          <div className={styles.publishedRecords}>
            {videoDetails}
            {playlistOptions}
            <details className={styles.publishHistory}>
              <summary>Schedule history</summary>
              <DestinationScheduleControls version={version} destination={destination} masterContent={masterContent}
                dirty={dirty} busy={true} />
            </details>
            {uploadDetails}
          </div>
        </> : uploadControls}
      />
    </section>
  );
}
