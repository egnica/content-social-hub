"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/components/ui.module.css";

function timestamp(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function YouTubeFramePicker({ video, clientId, isShort, disabled, onSelected }) {
  const playerRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setDuration(0); setTime(0); setError(""); }, [video?._id]);

  async function useFrame() {
    const player = playerRef.current;
    if (!player || !player.videoWidth || !player.videoHeight || working) return;
    setWorking(true); setError("");
    try {
      const canvas = document.createElement("canvas");
      // Keep the source frame's actual aspect ratio, not a stretched preview.
      const scale = Math.min(1, 1280 / Math.max(player.videoWidth, player.videoHeight));
      canvas.width = Math.max(1, Math.round(player.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(player.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser cannot capture a video frame.");
      context.drawImage(player, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not create the thumbnail image.")), "image/jpeg", 0.92));
      const filename = `youtube-frame-${String(video._id).slice(-8)}-${Math.round(player.currentTime * 1000)}.jpg`;
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, filename, contentType: "image/jpeg",
          size: blob.size, width: canvas.width, height: canvas.height,
          aspectRatio: canvas.width / canvas.height,
          orientation: canvas.width > canvas.height ? "landscape" : canvas.width < canvas.height ? "portrait" : "square" }),
      });
      const presign = await presignResponse.json();
      if (!presignResponse.ok) throw new Error(presign.error || "Could not prepare the thumbnail upload.");
      const upload = await fetch(presign.uploadUrl, { method: "PUT", headers: presign.headers, body: blob });
      if (!upload.ok) throw new Error("The thumbnail could not be stored privately. Try again.");
      const completedResponse = await fetch(`/api/media/${presign.media._id}/complete`, { method: "POST" });
      const completed = await completedResponse.json();
      if (!completedResponse.ok) throw new Error(completed.error || "Thumbnail upload confirmation failed.");
      onSelected(completed.media);
    } catch (cause) {
      setError(cause?.name === "SecurityError"
        ? "The private video host does not permit browser frame capture. The video bucket needs read CORS access from this app."
        : cause.message || "Unable to capture this frame.");
    } finally { setWorking(false); }
  }

  if (!video?._id) return null;
  return <div style={{ display: "grid", gap: 9, padding: 12, border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-soft)" }}>
    <strong>Choose thumbnail frame</strong>
    <p className={styles.fieldHint}>Pause the video or move the slider to choose a frame. The image is saved privately, not posted to YouTube.</p>
    <video key={String(video._id)} ref={playerRef} src={`/api/media/${video._id}/url`}
      crossOrigin="anonymous" preload="metadata" controls playsInline
      aria-label="Select a YouTube thumbnail frame"
      onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
      onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
      onError={() => setError("The source video could not be loaded for frame selection.")}
      style={{ width: "100%", maxHeight: isShort ? 310 : 240, objectFit: "contain", background: "#151515", borderRadius: 8 }} />
    <label style={{ display: "grid", gap: 5 }}>
      <span className={styles.fieldHint}>Frame at {timestamp(time)} / {timestamp(duration)}</span>
      <input aria-label="Thumbnail frame timestamp" type="range" min="0" max={duration || 1} step="0.1"
        value={Math.min(time, duration || 1)} disabled={!duration || working}
        onChange={event => { const next = Number(event.target.value); if (playerRef.current) playerRef.current.currentTime = next; setTime(next); }} />
    </label>
    <button type="button" className={styles.buttonSecondary} disabled={!duration || disabled || working}
      onClick={useFrame}>{working ? "Saving frame…" : "Use this frame as thumbnail"}</button>
    {error ? <p className={styles.errorNotice} role="alert">{error}</p> : null}
    <p className={styles.fieldHint}>YouTube Shorts may show a different thumbnail on some surfaces. Verify the actual result in YouTube Studio.</p>
  </div>;
}
