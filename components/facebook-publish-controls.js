"use client";

import { useMemo, useState } from "react";
import styles from "@/components/ui.module.css";
import { validateFacebookTextLinkPublishDraft } from "@/lib/facebook-publish-logic";

function exactPublishConfirmation(destinationName, form) {
  return [
    `Publish this exact Facebook post to ${destinationName}?`,
    "",
    "Message:",
    String(form.message || "").trim() || "(none)",
    "",
    "Link:",
    String(form.destinationUrl || "").trim() || "(none)",
    "",
    "This creates a real live Facebook Page post.",
  ].join("\n");
}

export default function FacebookPublishControls({
  version,
  destination,
  form,
  dirty,
  busy,
  masterChanged,
  onPublished,
}) {
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(null);
  const destinationName =
    version.destinationName || destination?.accountName || "Facebook Page";
  const validation = useMemo(
    () =>
      validateFacebookTextLinkPublishDraft({
        ...form,
        healthStatus: destination?.healthStatus || "unavailable",
        canPublish: destination?.canPublish === true,
        masterChanged,
        customized: version.customized === true,
      }),
    [destination, form, masterChanged, version.customized],
  );
  const alreadyPublished =
    version.lastPublishStatus === "succeeded" &&
    Number(version.publishedRevision || 0) === Number(version.revision || 0);
  const postUrl = attempt?.providerPostUrl || version.providerPostUrl || "";

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

    if (!window.confirm(exactPublishConfirmation(destinationName, form))) {
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
      setMessage(`Published live to ${destinationName}.`);
      onPublished?.(result.platformVersion, result.attempt);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div className={styles.sectionHeader}>
        <h2>Publish Now</h2>
        <p>
          L3-03 publishes text and links only. Facebook Account Health is checked
          again on the server immediately before submission.
        </p>
      </div>

      {dirty ? (
        <div className={styles.notice}>
          Save the Facebook version before publishing so the confirmed draft and
          server-side publish payload are identical.
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
            dirty ||
            !validation.publishable ||
            alreadyPublished
          }
        >
          {publishing ? "Publishing…" : alreadyPublished ? "Published" : "Publish Now"}
        </button>

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
