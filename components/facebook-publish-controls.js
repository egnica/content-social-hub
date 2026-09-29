"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/ui.module.css";
import { validateFacebookPublishDraft } from "@/lib/facebook-publish-logic";
import { normalizeFacebookProviderUrl } from "@/lib/facebook-provider-url";
import {
  getFacebookPublishControlState,
  isAttemptForRevision,
} from "@/lib/facebook-publish-state";

function exactPublishConfirmation(
  destinationName,
  form,
  media,
  videoThumbnailAsset,
) {
  const mediaCount = Array.isArray(form.mediaIds) ? form.mediaIds.length : 0;
  const linkLabel = mediaCount
    ? "Link (included in media post text/description):"
    : "Link:";
  const selected = (media || []).filter((asset) =>
    (form.mediaIds || []).includes(String(asset?._id || "")),
  );
  const primary =
    selected.find(
      (asset) => String(asset?._id || "") === String(form.primaryMediaId || ""),
    ) || selected[0];
  const videoThumbnailLabel = primary?.contentType?.startsWith("video/")
    ? videoThumbnailAsset?.originalName || "Facebook automatic"
    : "(not applicable)";

  return [
    `Publish this exact Facebook post to ${destinationName}?`,
    "",
    "Message:",
    String(form.message || "").trim() || "(none)",
    "",
    linkLabel,
    String(form.destinationUrl || "").trim() || "(none)",
    "",
    "Media:",
    mediaCount ? `${mediaCount} selected` : "(none)",
    "",
    "Video thumbnail:",
    videoThumbnailLabel,
    "",
    "This creates a real live Facebook Page post.",
  ].join("\n");
}

function attemptDate(attempt) {
  const value = attempt?.completedAt || attempt?.startedAt || attempt?.createdAt;
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function attemptLabel(status) {
  const labels = {
    submitting: "Submitting",
    uploading: "Uploading",
    processing: "Processing",
    succeeded: "Succeeded",
    failed: "Failed",
    unknown: "Review required",
  };

  return labels[String(status || "").toLowerCase()] || String(status || "Unknown");
}

export default function FacebookPublishControls({
  version,
  destination,
  form,
  media = [],
  videoThumbnailAsset = null,
  dirty,
  busy,
  masterChanged,
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
    version.destinationName || destination?.accountName || "Facebook Page";
  const validation = useMemo(
    () =>
      validateFacebookPublishDraft({
        ...form,
        mediaAssets: media,
        videoThumbnailAsset,
        healthStatus: destination?.healthStatus || "unavailable",
        canPublish: destination?.canPublish === true,
        masterChanged,
        customized: version.customized === true,
      }),
    [destination, form, masterChanged, media, videoThumbnailAsset, version.customized],
  );
  const currentAttempt = useMemo(() => {
    if (isAttemptForRevision(attempt, version.revision)) return attempt;
    return history.find((item) => isAttemptForRevision(item, version.revision)) || null;
  }, [attempt, history, version.revision]);
  const effectiveStatus =
    currentAttempt?.status ||
    (version.lastPublishStatus === "succeeded" ? "succeeded" : "");
  const controlState = getFacebookPublishControlState({
    status: effectiveStatus,
    publishedRevision: version.publishedRevision,
    revision: version.revision,
  });
  const processing = controlState.mode === "processing";
  const videoProcessing = currentAttempt?.status === "processing";
  const postUrl = normalizeFacebookProviderUrl(
    currentAttempt?.providerPostUrl || version.providerPostUrl || "",
  );
  const hasSelectedMedia = Array.isArray(form.mediaIds) && form.mediaIds.length > 0;

  async function refreshHistory({ preferLatest = false } = {}) {
    try {
      const response = await fetch(
        `/api/platform-versions/${version._id}/publish-attempts`,
        { cache: "no-store" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load Facebook publish history.");
      }

      const attempts = Array.isArray(result.attempts) ? result.attempts : [];
      setHistory(attempts);

      if (preferLatest) {
        const latestCurrent = attempts.find((item) =>
          isAttemptForRevision(item, version.revision),
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
      setError("Save the Facebook version before publishing it.");
      return;
    }

    if (!validation.publishable) {
      setError(validation.blocking.join(" "));
      return;
    }

    if (!controlState.canSubmit) {
      setError(
        controlState.mode === "locked"
          ? "The last Facebook result is uncertain. Review the recorded attempt before trying again."
          : "This Facebook version cannot be submitted again in its current state.",
      );
      return;
    }

    if (
      !window.confirm(
        exactPublishConfirmation(
          destinationName,
          form,
          media,
          videoThumbnailAsset,
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
        throw new Error(result.error || "Unable to publish this Facebook version.");
      }

      setAttempt(result.attempt || null);

      if (result.attempt?.status === "processing") {
        setMessage(
          `Facebook accepted the video for ${destinationName} and is processing it.`,
        );
      } else {
        setMessage(`Published live to ${destinationName}.`);
      }

      onPublished?.(result.platformVersion, result.attempt);
      await refreshHistory();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPublishing(false);
    }
  }

  async function checkVideoStatus() {
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
        throw new Error(
          result.error || "Unable to refresh Facebook video status.",
        );
      }

      setAttempt(result.attempt || null);
      onPublished?.(result.platformVersion, result.attempt);
      await refreshHistory();

      if (result.attempt?.status === "succeeded") {
        setMessage(`Facebook video is live on ${destinationName}.`);
      } else if (result.attempt?.status === "failed") {
        setError(
          "Facebook reported that video processing failed. The saved version can be retried.",
        );
      } else {
        setMessage("Facebook is still processing the video. Check again shortly.");
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
          Facebook Account Health is checked again on the server immediately
          before submission. Successful revisions and uncertain provider results
          are locked against duplicate publishing; only known failures can retry.
        </p>
      </div>

      {dirty ? (
        <div className={styles.notice}>
          Save the Facebook version before publishing so the confirmed draft and
          server-side publish payload are identical.
        </div>
      ) : null}

      {hasSelectedMedia && form.destinationUrl ? (
        <div className={styles.notice}>
          Media posts do not use the normal Facebook link-card treatment. The
          destination URL will be included in the image post text or video
          description.
        </div>
      ) : null}

      {processing ? (
        <div className={styles.notice}>
          Facebook already has this revision in progress. Do not publish it again.
          {videoProcessing ? " Use Check Video Status instead." : ""}
        </div>
      ) : null}

      {controlState.mode === "locked" ? (
        <div className={styles.errorNotice}>
          <strong>Review required</strong>
          <div style={{ marginTop: 6 }}>
            Facebook may have received this revision, but the result could not be
            confirmed. Automatic retry is blocked to prevent a duplicate post.
          </div>
        </div>
      ) : null}

      {controlState.mode === "retry" ? (
        <div className={styles.notice}>
          The last provider attempt definitively failed before a successful post
          was recorded. A new retry attempt is allowed and the prior failure stays
          in Publish history.
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

        {videoProcessing ? (
          <button
            className={styles.buttonSecondary}
            type="button"
            onClick={checkVideoStatus}
            disabled={busy || publishing || checkingStatus}
          >
            {checkingStatus ? "Checking…" : "Check Video Status"}
          </button>
        ) : null}

        {postUrl ? (
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
          <p>Prior attempts are preserved as an audit trail and are never overwritten.</p>
        </div>

        {historyLoading ? (
          <div className={styles.notice}>Loading publish history…</div>
        ) : history.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {history.map((item) => {
              const itemUrl = normalizeFacebookProviderUrl(item.providerPostUrl || "");
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
                    <span>{item.publishMode || "facebook"}</span>
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
          <div className={styles.notice}>No Facebook publish attempts yet.</div>
        )}
      </div>
    </div>
  );
}
