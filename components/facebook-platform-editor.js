"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/ui.module.css";
import FacebookPublishControls from "@/components/facebook-publish-controls";
import {
  isFacebookVersionOutOfSync,
  validateFacebookVersionDraft,
} from "@/lib/platform-version-logic";

function stringId(value) {
  return String(value || "");
}

function initialDraft(version) {
  return {
    message: version?.message || "",
    destinationUrl: version?.destinationUrl || "",
    mediaIds: (version?.mediaIds || []).map(stringId),
    primaryMediaId: stringId(version?.primaryMediaId),
  };
}

function linkHost(value) {
  if (!value) return "";

  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function previewableLink(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function mediaPreviewUrl(asset) {
  return asset?._id ? `/api/media/${asset._id}/url` : "";
}

function FacebookPreview({
  destination,
  form,
  media,
  linkPreview,
  linkPreviewStatus,
}) {
  const selectedMedia = media.filter((asset) =>
    form.mediaIds.includes(stringId(asset._id)),
  );
  const primary =
    selectedMedia.find(
      (asset) => stringId(asset._id) === stringId(form.primaryMediaId),
    ) || selectedMedia[0];
  const destinationName = destination?.accountName || "Facebook Page";
  const previewUrl = linkPreview?.url || form.destinationUrl;
  const previewTitle = linkPreview?.title || form.destinationUrl;
  const previewSource = linkPreview?.siteName || linkHost(previewUrl);

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2>Facebook Preview</h2>
        <p>Approximate preview only. Facebook controls final rendering.</p>
      </div>

      <div
        style={{
          overflow: "hidden",
          border: "1px solid #d8dde3",
          borderRadius: 14,
          background: "white",
          boxShadow: "0 8px 28px rgba(30, 40, 50, 0.08)",
        }}
      >
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {destination?.pictureUrl ? (
              <img
                src={destination.pictureUrl}
                alt=""
                width="42"
                height="42"
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  width: 42,
                  height: 42,
                  placeItems: "center",
                  borderRadius: "50%",
                  background: "#e8edf5",
                  fontWeight: 800,
                }}
              >
                {destinationName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <strong style={{ display: "block", fontSize: 14 }}>
                {destinationName}
              </strong>
              <span style={{ color: "#667085", fontSize: 12 }}>
                Just now · Facebook
              </span>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              whiteSpace: "pre-wrap",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {form.message || (
              <span style={{ color: "#98a2b3" }}>
                Your Facebook message preview
              </span>
            )}
          </div>
        </div>

        {primary ? (
          <div style={{ background: "#f4f6f8" }}>
            {primary.contentType?.startsWith("video/") ? (
              <video
                src={mediaPreviewUrl(primary)}
                muted
                preload="metadata"
                style={{ display: "block", width: "100%", maxHeight: 360 }}
              />
            ) : (
              <img
                src={mediaPreviewUrl(primary)}
                alt=""
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: 360,
                  objectFit: "cover",
                }}
              />
            )}
          </div>
        ) : form.destinationUrl ? (
          <div style={{ borderTop: "1px solid #e4e7ec" }}>
            {linkPreview?.imageUrl ? (
              <img
                src={linkPreview.imageUrl}
                alt=""
                referrerPolicy="no-referrer"
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: 280,
                  objectFit: "cover",
                  background: "#eef1f4",
                }}
              />
            ) : null}
            <div
              style={{
                padding: "14px 18px 16px",
                borderTop: linkPreview?.imageUrl ? "1px solid #e4e7ec" : 0,
                background: "#f7f8fa",
              }}
            >
              <span
                style={{
                  display: "block",
                  color: "#667085",
                  fontSize: 11,
                  textTransform: "uppercase",
                }}
              >
                {previewSource}
              </span>
              <strong
                style={{
                  display: "block",
                  marginTop: 5,
                  fontSize: 15,
                  lineHeight: 1.3,
                }}
              >
                {previewTitle}
              </strong>
              {linkPreview?.description ? (
                <span
                  style={{
                    display: "block",
                    marginTop: 5,
                    color: "#667085",
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {linkPreview.description}
                </span>
              ) : null}
              {linkPreviewStatus === "loading" ? (
                <span
                  style={{
                    display: "block",
                    marginTop: 6,
                    color: "#98a2b3",
                    fontSize: 11,
                  }}
                >
                  Loading page preview…
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {primary && form.destinationUrl ? (
          <div
            style={{
              padding: "11px 16px",
              borderTop: "1px solid #e4e7ec",
              color: "#667085",
              fontSize: 12,
            }}
          >
            Link: {form.destinationUrl}
          </div>
        ) : null}

        <div
          style={{
            padding: "11px 16px",
            borderTop: "1px solid #e4e7ec",
            color: "#667085",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Preview only — use Publish Now after saving and confirming the exact post.
        </div>
      </div>
    </div>
  );
}

function FacebookVersionEditor({ initialVersion, destination, masterContent }) {
  const router = useRouter();
  const [version, setVersion] = useState(initialVersion);
  const [form, setForm] = useState(() => initialDraft(initialVersion));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [linkPreview, setLinkPreview] = useState(null);
  const [linkPreviewStatus, setLinkPreviewStatus] = useState("idle");
  const media = masterContent.media || [];
  const masterChanged = isFacebookVersionOutOfSync(
    version,
    masterContent.revision,
  );
  const validation = useMemo(
    () =>
      validateFacebookVersionDraft({
        ...form,
        healthStatus: destination?.healthStatus || "unavailable",
        canPublish: destination?.canPublish === true,
        masterChanged,
        customized: version.customized === true,
      }),
    [destination, form, masterChanged, version.customized],
  );

  useEffect(() => {
    const destinationUrl = form.destinationUrl.trim();
    setLinkPreview(null);

    if (!destinationUrl) {
      setLinkPreviewStatus("idle");
      return undefined;
    }

    if (!previewableLink(destinationUrl)) {
      setLinkPreviewStatus("unavailable");
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLinkPreviewStatus("loading");

      try {
        const response = await fetch(
          `/api/link-preview?url=${encodeURIComponent(destinationUrl)}`,
          { signal: controller.signal },
        );
        const result = await response.json();

        if (!response.ok || !result.preview) {
          throw new Error(result.error || "Unable to load link preview.");
        }

        setLinkPreview(result.preview);
        setLinkPreviewStatus("ready");
      } catch (requestError) {
        if (requestError.name === "AbortError") return;
        setLinkPreview(null);
        setLinkPreviewStatus("unavailable");
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.destinationUrl]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setMessage("");
    setError("");
  }

  function toggleMedia(mediaId, checked) {
    setForm((current) => {
      const nextMediaIds = checked
        ? [...new Set([...current.mediaIds, mediaId])]
        : current.mediaIds.filter((id) => id !== mediaId);
      const nextPrimary = nextMediaIds.includes(current.primaryMediaId)
        ? current.primaryMediaId
        : nextMediaIds[0] || "";

      return {
        ...current,
        mediaIds: nextMediaIds,
        primaryMediaId: nextPrimary,
      };
    });
    setDirty(true);
    setMessage("");
    setError("");
  }

  async function requestUpdate(payload) {
    const response = await fetch(`/api/platform-versions/${version._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to save the Facebook version.");
    }

    return result.platformVersion;
  }

  async function saveVersion() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const saved = await requestUpdate(form);
      setVersion(saved);
      setForm(initialDraft(saved));
      setDirty(false);
      setMessage("Facebook version saved. Nothing has been published.");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetFromMaster() {
    if (
      (version.customized || dirty) &&
      !window.confirm(
        "Replace this Facebook-specific version with the current Master Content defaults?",
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const saved = await requestUpdate({ action: "reset_from_master" });
      setVersion(saved);
      setForm(initialDraft(saved));
      setDirty(false);
      setMessage("Facebook version updated from Master Content.");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function handlePublished(publishedVersion) {
    setVersion(publishedVersion);
    setForm(initialDraft(publishedVersion));
    setDirty(false);
    setMessage("Facebook post published successfully.");
    setError("");
    router.refresh();
  }

  return (
    <section className={styles.formCard} style={{ marginTop: 20 }}>
      <div className={styles.sectionHeader}>
        <h2>{version.destinationName || destination?.accountName || "Facebook"}</h2>
        <p>
          Facebook-specific version · Revision {version.revision || 1} ·{" "}
          {version.customized ? "Customized" : "Inherited from Master"}
        </p>
      </div>

      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {message ? <div className={styles.successNotice}>{message}</div> : null}

      {masterChanged ? (
        <div className={styles.notice}>
          <strong>Master content changed.</strong>{" "}
          {version.customized
            ? "Your Facebook-specific edits have been preserved. Use Update From Master only if you want to replace them."
            : "This Facebook version is based on an older Master revision."}
        </div>
      ) : null}

      {validation.blocking.length ? (
        <div className={styles.errorNotice}>
          <strong>Blocking validation</strong>
          <ul style={{ margin: "7px 0 0 18px" }}>
            {validation.blocking.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={styles.successNotice}>
          Live validation has no blocking issues for this draft.
        </div>
      )}

      {validation.warnings.length ? (
        <div className={styles.notice}>
          {validation.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}

      <div className={styles.twoColumn}>
        <div>
          <div className={styles.sectionHeader}>
            <h2>Facebook Version</h2>
            <p>
              Edit this destination independently from the shared Master Content.
            </p>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.fieldFull}>
              <span className={styles.label}>Facebook message</span>
              <textarea
                className={styles.textarea}
                value={form.message}
                onChange={(event) => update("message", event.target.value)}
                placeholder="Write the Facebook-specific message."
              />
            </label>

            <label className={styles.fieldFull}>
              <span className={styles.label}>Destination URL</span>
              <input
                className={styles.input}
                type="url"
                value={form.destinationUrl}
                onChange={(event) => update("destinationUrl", event.target.value)}
                placeholder="https://example.com/page"
              />
              {form.destinationUrl ? (
                <span
                  style={{
                    display: "block",
                    marginTop: 6,
                    color: "#667085",
                    fontSize: 12,
                  }}
                >
                  {linkPreviewStatus === "loading"
                    ? "Loading page image and link metadata…"
                    : linkPreviewStatus === "ready"
                      ? "Link preview loaded from the page's metadata."
                      : linkPreviewStatus === "unavailable"
                        ? "Page metadata could not be loaded. Facebook may still create its own link preview when published."
                        : ""}
                </span>
              ) : null}
            </label>
          </div>

          {media.length ? (
            <div style={{ marginTop: 22 }}>
              <div className={styles.sectionHeader}>
                <h2>Facebook media</h2>
                <p>Select from media already attached to Master Content.</p>
              </div>
              <div style={{ display: "grid", gap: 9 }}>
                {media.map((asset) => {
                  const mediaId = stringId(asset._id);
                  const checked = form.mediaIds.includes(mediaId);

                  return (
                    <label className={styles.checkboxRow} key={mediaId}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          toggleMedia(mediaId, event.target.checked)
                        }
                      />
                      <span>
                        <strong>{asset.originalName}</strong>
                        <span>{asset.contentType || "Media"}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {form.mediaIds.length ? (
                <label className={styles.field} style={{ marginTop: 14 }}>
                  <span className={styles.label}>Primary Facebook media</span>
                  <select
                    className={styles.select}
                    value={form.primaryMediaId}
                    onChange={(event) =>
                      update("primaryMediaId", event.target.value)
                    }
                  >
                    {media
                      .filter((asset) =>
                        form.mediaIds.includes(stringId(asset._id)),
                      )
                      .map((asset) => (
                        <option key={asset._id} value={asset._id}>
                          {asset.originalName}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          <div className={styles.formActions}>
            <button
              className={styles.buttonSecondary}
              type="button"
              onClick={resetFromMaster}
              disabled={saving}
            >
              {masterChanged ? "Update From Master" : "Reset to Master"}
            </button>
            <button
              className={styles.button}
              type="button"
              onClick={saveVersion}
              disabled={saving || !dirty}
            >
              {saving ? "Saving" : dirty ? "Save Facebook Version" : "Saved"}
            </button>
          </div>

          <FacebookPublishControls
            version={version}
            destination={destination}
            form={form}
            dirty={dirty}
            busy={saving}
            masterChanged={masterChanged}
            onPublished={handlePublished}
          />
        </div>

        <FacebookPreview
          destination={destination}
          form={form}
          media={media}
          linkPreview={linkPreview}
          linkPreviewStatus={linkPreviewStatus}
        />
      </div>
    </section>
  );
}

export default function FacebookPlatformEditors({
  masterContent,
  destinations,
  platformVersions,
}) {
  const activeFacebookVersions = platformVersions.filter(
    (version) => version.platform === "facebook" && version.active !== false,
  );

  if (!activeFacebookVersions.length) return null;

  return (
    <div>
      {activeFacebookVersions.map((version) => {
        const destination = destinations.find(
          (item) => stringId(item._id) === stringId(version.socialConnectionId),
        );

        return (
          <FacebookVersionEditor
            key={`${version._id}-${version.revision}-${masterContent.revision}`}
            initialVersion={version}
            destination={destination}
            masterContent={masterContent}
          />
        );
      })}
    </div>
  );
}
