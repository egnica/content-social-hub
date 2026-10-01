"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/ui.module.css";
import {
  getInstagramPublishControlState,
  isInstagramAttemptForRevision,
  normalizeInstagramProviderUrl,
} from "@/lib/instagram-publish-logic";
import { validateInstagramL505PublishDraft } from "@/lib/instagram-carousel-publish-logic";

function attemptDate(attempt) {
  const value = attempt?.completedAt || attempt?.startedAt || attempt?.createdAt;
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function attemptLabel(status) {
  const labels = {
    submitting: "Submitting",
    processing: "Processing",
    succeeded: "Succeeded",
    failed: "Failed",
    unknown: "Review required",
  };

  return labels[String(status || "").toLowerCase()] || String(status || "Unknown");
}

function orderedSelectedMedia(form, media) {
  const byId = new Map(
    (media || []).map((asset) => [String(asset?._id || ""), asset]),
  );

  return (form.mediaIds || [])
    .map((id) => byId.get(String(id || "")))
    .filter(Boolean);
}

function exactPublishConfirmation(destinationName, form, media, publishMode) {
  const selected = orderedSelectedMedia(form, media);
  const mediaLabel =
    publishMode === "carousel"
      ? "Carousel items"
      : publishMode === "reel"
        ? "Video"
        : "Image";
  const postLabel =
    publishMode === "carousel"
      ? "carousel"
      : publishMode === "reel"
        ? "Reel"
        : "post";

  return [
    `Publish this exact Instagram ${postLabel} to ${destinationName}?`,
    "",
    "Caption:",
    String(form.caption || "").trim() || "(none)",
    "",
    `${mediaLabel}:`,
    ...(selected.length
      ? selected.map(
          (asset, index) =>
            `${publishMode === "carousel" ? `${index + 1}. ` : ""}${asset?.originalName || "(missing)"}`,
        )
      : ["(missing)"]),
    "",
    `This creates one real live Instagram ${publishMode === "reel" ? "Reel" : "post"}.`,
  ].join("\n");
}

function processingMessage(publishMode, destinationName) {
  if (publishMode === "carousel") {
    return `Instagram accepted the carousel containers for ${destinationName} and is still processing them.`;
  }
  if (publishMode === "reel") {
    return `Instagram accepted the Reel container for ${destinationName} and is still processing the video.`;
  }
  return `Instagram accepted the image for ${destinationName} and is still processing it.`;
}

function failedMessage(publishMode) {
  if (publishMode === "carousel") {
    return "Instagram reported that carousel preparation failed before the final publish step. The saved revision can be retried.";
  }
  if (publishMode === "reel") {
    return "Instagram reported that the Reel container failed processing before the final publish step. The saved revision can be retried.";
  }
  return "Instagram reported that the image container failed processing. The saved revision can be retried.";
}

function stillProcessingMessage(publishMode) {
  if (publishMode === "carousel") {
    return "Instagram is still processing the carousel. Check again shortly.";
  }
  if (publishMode === "reel") {
    return "Instagram is still processing the recorded Reel container. Check again shortly; do not submit another Reel.";
  }
  return "Instagram is still processing the image. Check again shortly.";
}

export default function InstagramPublishControls({
  version,
  destination,
  form,
  media = [],
  dirty,
  busy,
  onPublished,
}) {
  const [publishing, setPublishing] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const destinationName =
    version.destinationName || destination?.accountName || "Instagram";
  const validation = useMemo(
    () =>
      validateInstagramL505PublishDraft({
        caption: form.caption,
        mediaIds: form.mediaIds,
        mediaAssets: media,
        healthStatus: destination?.healthStatus || "unavailable",
        canPublish: destination?.canPublish === true,
      }),
    [destination, form.caption, form.mediaIds, media],
  );
  const currentAttempt = useMemo(() => {
    if (isInstagramAttemptForRevision(attempt, version.revision)) return attempt;
    return (
      history.find((item) =>
        isInstagramAttemptForRevision(item, version.revision),
      ) || null
    );
  }, [attempt, history, version.revision]);
  const effectiveStatus =
    currentAttempt?.status ||
    (version.lastPublishStatus === "succeeded" ? "succeeded" : "");
  const controlState = getInstagramPublishControlState({
    status: effectiveStatus,
    publishedRevision: version.publishedRevision,
    revision: version.revision,
  });
  const postUrl = normalizeInstagramProviderUrl(
    currentAttempt?.providerPostUrl || version.providerPostUrl || "",
  );
  const providerProcessing = currentAttempt?.status === "processing";
  const missingPublishedLink =
    controlState.mode === "published" &&
    Boolean(currentAttempt?.providerPostId || version.providerPostId) &&
    !postUrl;
  const currentPublishMode =
    currentAttempt?.publishMode || validation.publishMode || "instagram";

  async function refreshHistory({ preferLatest = false } = {}) {
    try {
      const response = await fetch(
        `/api/platform-versions/${version._id}/publish-attempts`,
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load Instagram publish history.");
      }

      const attempts = Array.isArray(result.attempts) ? result.attempts : [];
      setHistory(attempts);

      if (preferLatest) {
        const latestCurrent = attempts.find((item) =>
          isInstagramAttemptForRevision(item, version.revision),
        );
        if (latestCurrent) setAttempt(latestCurrent);
      }
    } catch (requestError) {
      setError((current) => current || requestError.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    setAttempt(null);
    setHistory([]);
    setHistoryLoading(true);
    refreshHistory({ preferLatest: true });
    // Reload persisted attempt state whenever the saved version/revision changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version._id, version.revision]);

  async function publishNow() {
    setMessage("");
    setError("");

    if (dirty) {
      setError("Save the Instagram version before publishing it.");
      return;
    }

    if (!validation.publishable) {
      setError(validation.blocking.join(" "));
      return;
    }

    if (!controlState.canSubmit) {
      setError(
        controlState.mode === "locked"
          ? "The last Instagram result is uncertain. Review the recorded attempt before trying again."
          : "This Instagram version cannot be submitted again in its current state.",
      );
      return;
    }

    if (
      !window.confirm(
        exactPublishConfirmation(
          destinationName,
          form,
          media,
          validation.publishMode,
        ),
      )
    ) {
      return;
    }

    setPublishing(true);

    try {
      const response = await fetch(
        `/api/platform-versions/${version._id}/publish`,
        { method: "POST" },
      );
      const result = await response.json();

      if (!response.ok) {
        if (result.attempt) setAttempt(result.attempt);
        await refreshHistory();
        throw new Error(result.error || "Unable to publish this Instagram version.");
      }

      setAttempt(result.attempt || null);
      onPublished?.(result.platformVersion, result.attempt);
      await refreshHistory();

      if (result.attempt?.status === "processing") {
        setMessage(
          processingMessage(result.attempt?.publishMode, destinationName),
        );
      } else {
        setMessage(`Published live to ${destinationName}.`);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPublishing(false);
    }
  }

  async function checkStatus() {
    setMessage("");
    setError("");
    setCheckingStatus(true);

    try {
      const response = await fetch(
        `/api/platform-versions/${version._id}/publish`,
        { method: "GET" },
      );
      const result = await response.json();

      if (!response.ok) {
        if (result.attempt) setAttempt(result.attempt);
        await refreshHistory();
        throw new Error(result.error || "Unable to refresh Instagram publish status.");
      }

      setAttempt(result.attempt || null);
      onPublished?.(result.platformVersion, result.attempt);
      await refreshHistory();

      if (result.attempt?.status === "succeeded") {
        setMessage(
          result.attempt.providerPostUrl
            ? `Instagram post is live on ${destinationName}.`
            : "Instagram reports the post is live. The exact permalink is not available yet; refresh the post link again shortly.",
        );
      } else if (result.attempt?.status === "failed") {
        setError(failedMessage(result.attempt?.publishMode));
      } else {
        setMessage(stillProcessingMessage(result.attempt?.publishMode));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCheckingStatus(false);
    }
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div className={styles.sectionHeader}>
        <h2>Publish Now</h2>
        <p>
          Instagram supports single images, ordered 2–10 item carousels, and
          single-video Reels. Private S3 media is exposed to Meta only through
          short-lived provider access, and each saved revision keeps the same
          duplicate-safety and durable Publish History rules.
        </p>
      </div>

      {validation.publishMode === "reel" ? (
        <div className={styles.notice}>
          Reel source checks require MP4/MOV, 1 GB or smaller, 3 seconds–15
          minutes, and at most 1920 horizontal pixels. Meta also requires H.264
          or HEVC video, AAC 48 kHz audio, 23–60 FPS, up to 25 Mbps video and
          128 kbps audio; those codec/bitrate properties are confirmed by Meta
          while the recorded Reel container processes.
        </div>
      ) : null}

      {dirty ? (
        <div className={styles.notice}>
          Save the Instagram version before publishing so the confirmation and
          server-side payload are the same saved revision.
        </div>
      ) : null}

      {validation.blocking.length ? (
        <div className={styles.errorNotice}>
          <strong>Publish blocked</strong>
          <ul style={{ margin: "7px 0 0 18px" }}>
            {validation.blocking.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {providerProcessing ? (
        <div className={styles.notice}>
          Instagram already has provider container state for this revision. Do
          not submit it again; use Check Instagram Status so the recorded attempt
          continues without creating duplicate containers or posts.
        </div>
      ) : null}

      {controlState.mode === "locked" ? (
        <div className={styles.errorNotice}>
          <strong>Review required</strong>
          <div style={{ marginTop: 6 }}>
            Instagram may have accepted the final publish for this revision, but
            the result could not be confirmed. Automatic retry is blocked to
            prevent a duplicate.
          </div>
        </div>
      ) : null}

      {controlState.mode === "retry" ? (
        <div className={styles.notice}>
          The previous attempt failed before a live Instagram post was accepted.
          Retry is allowed and the prior failure stays in Publish History.
        </div>
      ) : null}

      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {message ? <div className={styles.successNotice}>{message}</div> : null}

      <div className={styles.formActions}>
        <button
          className={styles.button}
          type="button"
          onClick={publishNow}
          disabled={
            busy ||
            publishing ||
            checkingStatus ||
            dirty ||
            historyLoading ||
            !validation.publishable ||
            !controlState.canSubmit
          }
        >
          {publishing ? "Publishing…" : controlState.label}
        </button>

        {providerProcessing || missingPublishedLink ? (
          <button
            className={styles.buttonSecondary}
            type="button"
            onClick={checkStatus}
            disabled={busy || publishing || checkingStatus}
          >
            {checkingStatus
              ? "Checking…"
              : missingPublishedLink
                ? "Refresh Post Link"
                : "Check Instagram Status"}
          </button>
        ) : null}

        {controlState.mode === "published" && postUrl ? (
          <a
            className={styles.buttonSecondary}
            href={postUrl}
            target="_blank"
            rel="noreferrer"
          >
            View Post
          </a>
        ) : null}
      </div>

      <div style={{ marginTop: 22 }}>
        <div className={styles.sectionHeader}>
          <h2>Publish History</h2>
          <p>Prior Instagram attempts are preserved and are never overwritten.</p>
        </div>

        {historyLoading ? (
          <div className={styles.notice}>Loading publish history…</div>
        ) : history.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {history.map((item) => {
              const itemUrl = normalizeInstagramProviderUrl(
                item.providerPostUrl || "",
              );
              const providerError = item.providerError?.message || "";

              return (
                <div
                  key={item._id}
                  style={{
                    padding: 12,
                    border: "1px solid #e4e7ec",
                    borderRadius: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <strong>{attemptLabel(item.status)}</strong>
                    <span>Revision {item.platformVersionRevision || "—"}</span>
                    <span>{item.publishMode || currentPublishMode}</span>
                    {attemptDate(item) ? <span>{attemptDate(item)}</span> : null}
                  </div>
                  {providerError ? (
                    <div style={{ marginTop: 6 }}>{providerError}</div>
                  ) : null}
                  {itemUrl ? (
                    <div style={{ marginTop: 8 }}>
                      <a href={itemUrl} target="_blank" rel="noreferrer">
                        View Post
                      </a>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.notice}>No Instagram publish attempts yet.</div>
        )}
      </div>
    </div>
  );
}
