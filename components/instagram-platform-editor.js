"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import InstagramPublishControls from "@/components/instagram-publish-controls";
import styles from "@/components/ui.module.css";
import {
  instagramMediaModeLabel,
  isInstagramVersionOutOfSync,
  validateInstagramVersionDraft,
} from "@/lib/platform-version-logic";

function stringId(value) {
  return String(value || "");
}

function initialDraft(version) {
  return {
    caption: version?.caption || "",
    mediaIds: (version?.mediaIds || []).map(stringId),
    primaryMediaId: stringId(version?.primaryMediaId),
  };
}

function mediaPreviewUrl(asset) {
  if (!asset) return "";
  return asset.previewUrl || (asset._id ? `/api/media/${asset._id}/url` : "");
}

function PreviewMedia({ asset, label = "" }) {
  if (!asset) return null;

  if (asset.contentType?.startsWith("video/")) {
    return (
      <div style={{ position: "relative", background: "#111" }}>
        <video
          src={mediaPreviewUrl(asset)}
          muted
          preload="metadata"
          style={{
            display: "block",
            width: "100%",
            maxHeight: 440,
            objectFit: "cover",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: 12,
            bottom: 10,
            padding: "4px 8px",
            borderRadius: 999,
            background: "rgba(0,0,0,.68)",
            color: "white",
            fontSize: 11,
          }}
        >
          {label || "Video"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", background: "#f4f4f5" }}>
      <img
        src={mediaPreviewUrl(asset)}
        alt=""
        style={{
          display: "block",
          width: "100%",
          maxHeight: 440,
          objectFit: "cover",
        }}
      />
      {label ? (
        <span
          style={{
            position: "absolute",
            left: 12,
            bottom: 10,
            padding: "4px 8px",
            borderRadius: 999,
            background: "rgba(0,0,0,.68)",
            color: "white",
            fontSize: 11,
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

function InstagramPreview({ destination, form, media, mediaMode }) {
  const selectedMedia = media.filter((asset) =>
    form.mediaIds.includes(stringId(asset._id)),
  );
  const primary =
    selectedMedia.find(
      (asset) => stringId(asset._id) === stringId(form.primaryMediaId),
    ) || selectedMedia[0];
  const destinationName =
    destination?.accountName || destination?.providerAccountId || "Instagram";

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h2>Instagram Preview</h2>
        <p>Approximate preview only. Instagram controls final rendering.</p>
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
          }}
        >
          {destination?.pictureUrl ? (
            <img
              src={destination.pictureUrl}
              alt=""
              width="38"
              height="38"
              style={{ borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                display: "grid",
                width: 38,
                height: 38,
                placeItems: "center",
                borderRadius: "50%",
                background: "#ececf0",
                fontWeight: 800,
              }}
            >
              {destinationName.replace(/^@/, "").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <strong style={{ display: "block", fontSize: 14 }}>
              {destinationName}
            </strong>
            <span style={{ color: "#667085", fontSize: 12 }}>
              Instagram · {instagramMediaModeLabel(mediaMode)}
            </span>
          </div>
        </div>

        {mediaMode === "carousel" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: selectedMedia.length > 1 ? "1fr 1fr" : "1fr",
              gap: 2,
              background: "#ececf0",
            }}
          >
            {selectedMedia.slice(0, 4).map((asset, index) => (
              <PreviewMedia
                key={asset._id}
                asset={asset}
                label={`${index + 1}/${selectedMedia.length}`}
              />
            ))}
          </div>
        ) : primary ? (
          <PreviewMedia
            asset={primary}
            label={mediaMode === "reel" ? "Reel preview" : ""}
          />
        ) : (
          <div
            style={{
              display: "grid",
              minHeight: 260,
              placeItems: "center",
              padding: 24,
              background: "#f5f5f6",
              color: "#667085",
              textAlign: "center",
            }}
          >
            Instagram requires an image or video. Choose compatible Master
            Content media to create a publishable destination draft.
          </div>
        )}

        <div style={{ padding: "14px 16px" }}>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5 }}>
            <strong>{destinationName}</strong>{" "}
            {form.caption || (
              <span style={{ color: "#98a2b3" }}>Instagram caption preview</span>
            )}
          </div>
        </div>

        <div
          style={{
            padding: "11px 16px",
            borderTop: "1px solid #e4e7ec",
            color: "#667085",
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Preview only. L5-04 Publish Now supports a single compatible JPEG image.
        </div>
      </div>
    </div>
  );
}

function InstagramVersionEditor({ initialVersion, destination, masterContent }) {
  const router = useRouter();
  const [version, setVersion] = useState(initialVersion);
  const [form, setForm] = useState(() => initialDraft(initialVersion));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const media = masterContent.media || [];
  const masterChanged = isInstagramVersionOutOfSync(
    version,
    masterContent.revision,
  );
  const selectedMedia = useMemo(
    () => media.filter((asset) => form.mediaIds.includes(stringId(asset._id))),
    [form.mediaIds, media],
  );
  const validation = useMemo(
    () =>
      validateInstagramVersionDraft({
        ...form,
        media,
        healthStatus: destination?.healthStatus || "unavailable",
        canPublish: destination?.canPublish === true,
        masterChanged,
        customized: version.customized === true,
      }),
    [destination, form, masterChanged, media, version.customized],
  );

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
      throw new Error(result.error || "Unable to save the Instagram version.");
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
      setMessage("Instagram version saved.");
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
        "Replace this Instagram-specific version with the current Master Content defaults?",
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
      setMessage("Instagram version updated from Master Content.");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function handlePublished(savedVersion) {
    if (!savedVersion) return;
    setVersion(savedVersion);
    setForm(initialDraft(savedVersion));
    setDirty(false);
    router.refresh();
  }

  return (
    <section className={styles.formCard} style={{ marginTop: 20 }}>
      <div className={styles.sectionHeader}>
        <h2>{version.destinationName || destination?.accountName || "Instagram"}</h2>
        <p>
          Instagram-specific version · Revision {version.revision || 1} ·{" "}
          {version.customized ? "Customized" : "Inherited from Master"}
        </p>
      </div>

      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {message ? <div className={styles.successNotice}>{message}</div> : null}

      {masterChanged ? (
        <div className={styles.notice}>
          <strong>Master content changed.</strong>{" "}
          {version.customized
            ? "Your Instagram-specific edits have been preserved. Use Update From Master only if you want to replace them."
            : "This Instagram version is based on an older Master revision."}
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
          Live validation has no blocking issues for this Instagram draft.
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
            <h2>Instagram Version</h2>
            <p>
              Caption and selected media can differ from Master Content without
              changing Facebook.
            </p>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.fieldFull}>
              <span className={styles.label}>Instagram caption</span>
              <textarea
                className={styles.textarea}
                value={form.caption}
                onChange={(event) => update("caption", event.target.value)}
                placeholder="Write the Instagram-specific caption."
              />
            </label>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className={styles.sectionHeader}>
              <h2>Instagram media</h2>
              <p>
                Choose compatible media attached to Master Content. L5-04 can
                publish one JPEG image; carousel and Reel publishing remain later
                Level 5 tasks.
              </p>
            </div>

            {media.length ? (
              <div style={{ display: "grid", gap: 9 }}>
                {media.map((asset) => {
                  const mediaId = stringId(asset._id);
                  const checked = form.mediaIds.includes(mediaId);
                  const compatible =
                    asset.contentType?.startsWith("image/") ||
                    asset.contentType?.startsWith("video/");

                  return (
                    <label className={styles.checkboxRow} key={mediaId}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={(!compatible && !checked) || saving}
                        onChange={(event) =>
                          toggleMedia(mediaId, event.target.checked)
                        }
                      />
                      <span>
                        <strong>{asset.originalName}</strong>
                        <span>
                          {asset.contentType || "Media"}
                          {!compatible ? " · not Instagram compatible" : ""}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className={styles.notice}>
                No media is attached to Master Content. This Instagram version
                remains incompatible until an image or video is added.
              </div>
            )}

            <div className={styles.notice} style={{ marginTop: 12 }}>
              <strong>Detected Instagram format:</strong>{" "}
              {instagramMediaModeLabel(validation.mediaMode)}
            </div>

            {form.mediaIds.length ? (
              <label className={styles.field} style={{ marginTop: 14 }}>
                <span className={styles.label}>Primary Instagram media</span>
                <select
                  className={styles.select}
                  value={form.primaryMediaId}
                  onChange={(event) => update("primaryMediaId", event.target.value)}
                >
                  {selectedMedia.map((asset) => (
                    <option key={asset._id} value={asset._id}>
                      {asset.originalName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

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
              {saving ? "Saving" : dirty ? "Save Instagram Version" : "Saved"}
            </button>
          </div>

          <InstagramPublishControls
            version={version}
            destination={destination}
            form={form}
            media={media}
            dirty={dirty}
            busy={saving}
            onPublished={handlePublished}
          />
        </div>

        <InstagramPreview
          destination={destination}
          form={form}
          media={media}
          mediaMode={validation.mediaMode}
        />
      </div>
    </section>
  );
}

export default function InstagramPlatformEditors({
  masterContent,
  destinations,
  platformVersions,
}) {
  const activeInstagramVersions = platformVersions.filter(
    (version) => version.platform === "instagram" && version.active !== false,
  );

  if (!activeInstagramVersions.length) return null;

  return (
    <div>
      {activeInstagramVersions.map((version) => {
        const destination = destinations.find(
          (item) => stringId(item._id) === stringId(version.socialConnectionId),
        );

        return (
          <InstagramVersionEditor
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
