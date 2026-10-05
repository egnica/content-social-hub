"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/ui.module.css";
import FacebookPublishControls from "@/components/facebook-publish-controls";
import DestinationScheduleControls from "@/components/facebook-schedule-controls";
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
    videoThumbnailMediaId: stringId(version?.videoThumbnailMediaId),
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
  if (!asset) return "";
  return asset.previewUrl || (asset._id ? `/api/media/${asset._id}/url` : "");
}

function putFile(url, headers, file) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);

    Object.entries(headers).forEach(([name, value]) => {
      request.setRequestHeader(name, value);
    });

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("S3 rejected the thumbnail upload."));
    };
    request.onerror = () =>
      reject(new Error("The thumbnail upload could not reach S3."));
    request.send(file);
  });
}

function FacebookPreview({
  destination,
  form,
  media,
  videoThumbnailAsset,
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
  const useVideoThumbnail = Boolean(
    primary?.contentType?.startsWith("video/") &&
      form.videoThumbnailMediaId &&
      videoThumbnailAsset &&
      stringId(videoThumbnailAsset._id) === form.videoThumbnailMediaId,
  );

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
              useVideoThumbnail ? (
                <div style={{ position: "relative" }}>
                  <img
                    src={mediaPreviewUrl(videoThumbnailAsset)}
                    alt="Facebook video thumbnail preview"
                    style={{
                      display: "block",
                      width: "100%",
                      maxHeight: 360,
                      objectFit: "cover",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      display: "grid",
                      width: 48,
                      height: 48,
                      placeItems: "center",
                      borderRadius: "50%",
                      background: "rgba(0,0,0,.68)",
                      color: "white",
                      fontSize: 20,
                    }}
                  >
                    ▶
                  </span>
                </div>
              ) : (
                <video
                  src={mediaPreviewUrl(primary)}
                  muted
                  preload="metadata"
                  style={{ display: "block", width: "100%", maxHeight: 360 }}
                />
              )
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
  const thumbnailInputRef = useRef(null);
  const [version, setVersion] = useState(initialVersion);
  const [form, setForm] = useState(() => initialDraft(initialVersion));
  const [thumbnailAsset, setThumbnailAsset] = useState(
    initialVersion.videoThumbnail || null,
  );
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewState, setPreviewState] = useState(null);
  const previewUrl = form.destinationUrl.trim();
  const linkPreview =
    previewState?.url === previewUrl ? previewState.preview : null;
  const linkPreviewStatus = !previewUrl
    ? "idle"
    : !previewableLink(previewUrl)
      ? "unavailable"
      : previewState?.url === previewUrl
        ? previewState.status
        : "loading";
  const media = useMemo(() => masterContent.media || [], [masterContent.media]);
  const masterChanged = isFacebookVersionOutOfSync(
    version,
    masterContent.revision,
  );
  const selectedMedia = useMemo(
    () =>
      media.filter((asset) => form.mediaIds.includes(stringId(asset._id))),
    [form.mediaIds, media],
  );
  const primaryMedia = useMemo(
    () =>
      selectedMedia.find(
        (asset) => stringId(asset._id) === stringId(form.primaryMediaId),
      ) || selectedMedia[0] || null,
    [form.primaryMediaId, selectedMedia],
  );
  const primaryIsVideo = Boolean(
    primaryMedia?.contentType?.startsWith("video/"),
  );
  const thumbnailOptions = useMemo(() => {
    const byId = new Map();

    for (const asset of media) {
      if (asset.contentType?.startsWith("image/") && asset._id) {
        byId.set(stringId(asset._id), asset);
      }
    }

    if (masterContent.defaultVideoThumbnail?._id) {
      byId.set(
        stringId(masterContent.defaultVideoThumbnail._id),
        masterContent.defaultVideoThumbnail,
      );
    }

    if (thumbnailAsset?._id) {
      byId.set(stringId(thumbnailAsset._id), thumbnailAsset);
    }

    return [...byId.values()];
  }, [masterContent.defaultVideoThumbnail, media, thumbnailAsset]);
  const resolvedThumbnailAsset = useMemo(
    () =>
      thumbnailOptions.find(
        (asset) => stringId(asset._id) === form.videoThumbnailMediaId,
      ) || null,
    [form.videoThumbnailMediaId, thumbnailOptions],
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
    if (!destinationUrl) {
      return undefined;
    }

    if (!previewableLink(destinationUrl)) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewState({
        url: destinationUrl,
        preview: null,
        status: "loading",
      });

      try {
        const response = await fetch(
          `/api/link-preview?url=${encodeURIComponent(destinationUrl)}`,
          { signal: controller.signal },
        );
        const result = await response.json();

        if (!response.ok || !result.preview) {
          throw new Error(result.error || "Unable to load link preview.");
        }

        if (controller.signal.aborted) return;
        setPreviewState({
          url: destinationUrl,
          preview: result.preview,
          status: "ready",
        });
      } catch (requestError) {
        if (requestError.name === "AbortError" || controller.signal.aborted)
          return;
        setPreviewState({
          url: destinationUrl,
          preview: null,
          status: "unavailable",
        });
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

  function selectPrimaryFacebookMedia(value) {
    if (value !== "__link_preview__") {
      update("primaryMediaId", value);
      return;
    }

    setForm((current) => ({
      ...current,
      mediaIds: [],
      primaryMediaId: "",
    }));
    setDirty(true);
    setMessage("");
    setError("");
  }

  async function uploadFacebookThumbnail(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setMessage("");
    setError("");

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Facebook video thumbnails must be image files.");
      return;
    }

    setThumbnailUploading(true);

    try {
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: masterContent.clientId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      const presignResult = await presignResponse.json();

      if (!presignResponse.ok) {
        throw new Error(
          presignResult.error || "Unable to prepare the Facebook thumbnail upload.",
        );
      }

      await putFile(presignResult.uploadUrl, presignResult.headers, file);

      const completeResponse = await fetch(
        `/api/media/${presignResult.media._id}/complete`,
        { method: "POST" },
      );
      const completeResult = await completeResponse.json();

      if (!completeResponse.ok) {
        throw new Error(
          completeResult.error || "Unable to confirm the Facebook thumbnail upload.",
        );
      }

      const uploaded = completeResult.media;
      setThumbnailAsset(uploaded);
      update("videoThumbnailMediaId", stringId(uploaded._id));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setThumbnailUploading(false);
    }
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
      setThumbnailAsset(
        stringId(saved.videoThumbnailMediaId) ===
          stringId(masterContent.defaultVideoThumbnail?._id)
          ? masterContent.defaultVideoThumbnail
          : saved.videoThumbnail || null,
      );
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

          {media.length || linkPreview?.imageUrl ? (
            <div style={{ marginTop: 22 }}>
              <div className={styles.sectionHeader}>
                <h2>Facebook media</h2>
                <p>
                  Choose attached Master Content media or the Destination URL
                  link preview.
                </p>
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

              {form.mediaIds.length || linkPreview?.imageUrl ? (
                <label className={styles.field} style={{ marginTop: 14 }}>
                  <span className={styles.label}>Primary Facebook media</span>
                  <select
                    className={styles.select}
                    value={
                      form.mediaIds.length
                        ? form.primaryMediaId
                        : "__link_preview__"
                    }
                    onChange={(event) =>
                      selectPrimaryFacebookMedia(event.target.value)
                    }
                  >
                    {linkPreview?.imageUrl ? (
                      <option value="__link_preview__">
                        Link preview image — from page metadata
                      </option>
                    ) : null}
                    {selectedMedia.map((asset) => (
                      <option key={asset._id} value={asset._id}>
                        {asset.originalName}
                      </option>
                    ))}
                  </select>
                  {linkPreview?.imageUrl ? (
                    <span
                      style={{
                        display: "block",
                        marginTop: 6,
                        color: "#667085",
                        fontSize: 12,
                      }}
                    >
                      Choose the link preview to publish this as a Facebook link
                      post without attaching Master Content media.
                    </span>
                  ) : null}
                </label>
              ) : null}

              {primaryIsVideo ? (
                <div style={{ marginTop: 16 }}>
                  <div className={styles.sectionHeader}>
                    <h2>Facebook video thumbnail / cover</h2>
                    <p>
                      Inherited from Master by default. Change it here only for
                      Facebook.
                    </p>
                  </div>
                  <label className={styles.field}>
                    <span className={styles.label}>Facebook thumbnail</span>
                    <select
                      className={styles.select}
                      value={form.videoThumbnailMediaId}
                      onChange={(event) =>
                        update("videoThumbnailMediaId", event.target.value)
                      }
                    >
                      <option value="">Let Facebook choose automatically</option>
                      {thumbnailOptions.map((asset) => (
                        <option key={asset._id} value={asset._id}>
                          {asset.originalName}
                        </option>
                      ))}
                    </select>
                  </label>
                  {resolvedThumbnailAsset ? (
                    <div
                      style={{
                        marginTop: 10,
                        width: 220,
                        overflow: "hidden",
                        border: "1px solid #d8dde3",
                        borderRadius: 10,
                      }}
                    >
                      <img
                        src={mediaPreviewUrl(resolvedThumbnailAsset)}
                        alt="Facebook video thumbnail"
                        style={{
                          display: "block",
                          width: "100%",
                          maxHeight: 140,
                          objectFit: "cover",
                        }}
                      />
                    </div>
                  ) : null}
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={uploadFacebookThumbnail}
                    hidden
                  />
                  <button
                    className={styles.buttonSecondary}
                    type="button"
                    style={{ marginTop: 10 }}
                    onClick={() => thumbnailInputRef.current?.click()}
                    disabled={thumbnailUploading || saving}
                  >
                    {thumbnailUploading
                      ? "Uploading Thumbnail…"
                      : "Upload Facebook Thumbnail"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={styles.formActions}>
            <button
              className={styles.buttonSecondary}
              type="button"
              onClick={resetFromMaster}
              disabled={saving || thumbnailUploading}
            >
              {masterChanged ? "Update From Master" : "Reset to Master"}
            </button>
            <button
              className={styles.button}
              type="button"
              onClick={saveVersion}
              disabled={saving || thumbnailUploading || !dirty}
            >
              {saving ? "Saving" : dirty ? "Save Facebook Version" : "Saved"}
            </button>
          </div>

          <DestinationScheduleControls
            version={version}
            destination={destination}
            masterContent={masterContent}
            dirty={dirty}
            busy={saving || thumbnailUploading}
          />

          <FacebookPublishControls
            version={version}
            destination={destination}
            form={form}
            media={media}
            videoThumbnailAsset={resolvedThumbnailAsset}
            dirty={dirty}
            busy={saving || thumbnailUploading}
            masterChanged={masterChanged}
            onPublished={handlePublished}
          />
        </div>

        <FacebookPreview
          destination={destination}
          form={form}
          media={media}
          videoThumbnailAsset={resolvedThumbnailAsset}
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
