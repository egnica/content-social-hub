"use client";

import { useMemo, useState } from "react";
import styles from "@/components/ui.module.css";
import { validateFacebookPublishDraft } from "@/lib/facebook-publish-logic";
import { normalizeFacebookProviderUrl } from "@/lib/facebook-provider-url";

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
  const alreadyPublished =
    version.lastPublishStatus === "succeeded" &&
    Number(version.publishedRevision || 0) === Number(version.revision || 0);
  const processing =
    attempt?.status === "processing" || version.lastPublishStatus === "processing";
  const postUrl = normalizeFacebookProviderUrl(
    attempt?.providerPostUrl || version.providerPostUrl || "",
  );
  const hasSelectedMedia = Array.isArray(form.mediaIds) && form.mediaIds.length > 0;

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
        throw new Error(
          result.error || "Unable to refresh Facebook video status.",
        );
      }

      setAttempt(result.attempt || null);
      onPublished?.(result.platformVersion, result.attempt);

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
          L3-05 publishes text, links, images, and one standard Facebook Page
          video from private media. Video thumbnails can inherit from Master or
          be overridden for Facebook. Reels are not part of this flow. Facebook
          Account Health is checked again on the server immediately before
          submission.
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
          Facebook has accepted this video and is processing it. Do not publish
          the same version again; use Check Video Status instead.
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
            !validation.publishable ||
            alreadyPublished ||
            processing
          }
        >
          {publishing
            ? "Publishing…"
            : alreadyPublished
              ? "Published"
              : processing
                ? "Video Processing"
                : "Publish Now"}
        </button>

        {processing ? (
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
    </div>
  );
}
