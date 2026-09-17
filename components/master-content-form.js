"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/ui.module.css";

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 bytes";
  const units = ["bytes", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  const amount = bytes / 1024 ** exponent;
  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
}

function orientation(width, height) {
  if (!width || !height) return null;
  if (Math.abs(width - height) / Math.max(width, height) < 0.03) return "square";
  return width > height ? "landscape" : "portrait";
}

function inspectImage(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      URL.revokeObjectURL(objectUrl);
      resolve({
        width,
        height,
        duration: null,
        aspectRatio: height ? width / height : null,
        orientation: orientation(width, height),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({});
    };
    image.src = objectUrl;
  });
}

function inspectVideo(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";

    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      URL.revokeObjectURL(objectUrl);
      resolve({
        width,
        height,
        duration,
        aspectRatio: height ? width / height : null,
        orientation: orientation(width, height),
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({});
    };
    video.src = objectUrl;
  });
}

async function inspectMedia(file) {
  if (file.type.startsWith("image/")) return inspectImage(file);
  if (file.type.startsWith("video/")) return inspectVideo(file);
  return {};
}

function putFile(url, headers, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);

    Object.entries(headers).forEach(([name, value]) => {
      request.setRequestHeader(name, value);
    });

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("S3 rejected the upload."));
    };
    request.onerror = () => reject(new Error("The upload could not reach S3."));
    request.send(file);
  });
}

function initialForm(content) {
  return {
    internalTitle: content?.internalTitle || "",
    clientId: content?.clientId || "",
    text: content?.text || "",
    primaryUrl: content?.primaryUrl || "",
    contentLength: content?.contentLength || "short",
    reusable: Boolean(content?.reusable),
    defaultPrimaryMediaId: content?.defaultPrimaryMediaId || "",
    defaultReleaseAt: toLocalDateTime(content?.defaultReleaseAt),
  };
}

export default function MasterContentForm({ clients, content = null }) {
  const router = useRouter();
  const linkInputRef = useRef(null);
  const textInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [form, setForm] = useState(() => initialForm(content));
  const [media, setMedia] = useState(() =>
    (content?.media || []).map((asset) => ({
      ...asset,
      previewUrl: `/api/media/${asset._id}/url`,
      progress: 100,
    })),
  );
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isEditing = Boolean(content?._id);

  const defaultMediaOptions = useMemo(
    () => media.filter((asset) => asset.status !== "error"),
    [media],
  );

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function focusField(ref) {
    ref.current?.focus();
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function changeClient(nextClientId) {
    if (media.length && nextClientId !== form.clientId) {
      const shouldChange = window.confirm(
        "Changing the client will detach the media currently shown on this content item.",
      );
      if (!shouldChange) return;
      setMedia([]);
      setForm((current) => ({
        ...current,
        clientId: nextClientId,
        defaultPrimaryMediaId: "",
      }));
      return;
    }

    update("clientId", nextClientId);
  }

  function setProgress(localId, progress, status = "uploading") {
    setMedia((current) =>
      current.map((asset) =>
        asset.localId === localId ? { ...asset, progress, status } : asset,
      ),
    );
  }

  async function uploadFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setMessage("");

    if (!form.clientId) {
      setErrors((current) => ({ ...current, clientId: "Choose a client before uploading." }));
      return;
    }

    if (!files.length) return;
    setUploading(true);

    for (const file of files) {
      const localId = `${file.name}-${file.size}-${file.lastModified}`;
      const localPreviewUrl = URL.createObjectURL(file);
      setMedia((current) => [
        ...current,
        {
          localId,
          originalName: file.name,
          contentType: file.type,
          size: file.size,
          previewUrl: localPreviewUrl,
          progress: 0,
          status: "inspecting",
        },
      ]);

      try {
        const metadata = await inspectMedia(file);
        setProgress(localId, 2);
        const presignResponse = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: form.clientId,
            filename: file.name,
            contentType: file.type,
            size: file.size,
            ...metadata,
          }),
        });
        const presignResult = await presignResponse.json();

        if (!presignResponse.ok) {
          throw new Error(presignResult.error || "Unable to prepare the upload.");
        }

        await putFile(
          presignResult.uploadUrl,
          presignResult.headers,
          file,
          (progress) => setProgress(localId, progress),
        );

        const completeResponse = await fetch(
          `/api/media/${presignResult.media._id}/complete`,
          { method: "POST" },
        );
        const completeResult = await completeResponse.json();

        if (!completeResponse.ok) {
          throw new Error(completeResult.error || "Unable to confirm the upload.");
        }

        URL.revokeObjectURL(localPreviewUrl);
        setMedia((current) =>
          current.map((asset) =>
            asset.localId === localId
              ? {
                  ...completeResult.media,
                  localId,
                  previewUrl: `/api/media/${completeResult.media._id}/url`,
                  progress: 100,
                }
              : asset,
          ),
        );
      } catch (uploadError) {
        setMedia((current) =>
          current.map((asset) =>
            asset.localId === localId
              ? { ...asset, status: "error", error: uploadError.message }
              : asset,
          ),
        );
      }
    }

    setUploading(false);
  }

  function moveMedia(index, direction) {
    const destination = index + direction;
    if (destination < 0 || destination >= media.length) return;

    setMedia((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }

  function removeMedia(index) {
    const removed = media[index];
    setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index));

    if (form.defaultPrimaryMediaId === removed?._id) {
      update("defaultPrimaryMediaId", "");
    }
  }

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setErrors({});

    try {
      const endpoint = isEditing ? `/api/content/${content._id}` : "/api/content";
      const response = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          defaultReleaseAt: form.defaultReleaseAt
            ? new Date(form.defaultReleaseAt).toISOString()
            : "",
          mediaIds: media
            .filter((asset) => asset._id && asset.status !== "error")
            .map((asset) => asset._id),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setErrors(result.errors || {});
        throw new Error(result.error || "Unable to save the content package.");
      }

      setMessage("Master Content saved.");
      if (!isEditing) {
        router.push(`/content/${result.content._id}`);
      } else {
        router.refresh();
      }
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setPending(false);
    }
  }

  async function deleteMasterContent() {
    if (!isEditing) return;

    const confirmed = window.confirm(
      `Delete "${content.internalTitle}"?\n\nThis permanently deletes the Master Content package. Uploaded media remains stored privately and is not deleted.`,
    );

    if (!confirmed) return;

    setDeleting(true);
    setMessage("");
    setErrors({});

    try {
      const response = await fetch(`/api/content/${content._id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete the content package.");
      }

      router.push("/content");
      router.refresh();
    } catch (requestError) {
      setErrors({ delete: requestError.message });
      setMessage(requestError.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form className={styles.formCard} onSubmit={submit}>
      <div className={styles.entryOptions} aria-label="Creation entry points">
        <button
          className={styles.entryOption}
          type="button"
          onClick={() => focusField(linkInputRef)}
        >
          Add Link
        </button>
        <button
          className={styles.entryOption}
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={uploading}
        >
          Upload Image
        </button>
        <button
          className={styles.entryOption}
          type="button"
          onClick={() => videoInputRef.current?.click()}
          disabled={uploading}
        >
          Upload Video
        </button>
        <button
          className={styles.entryOption}
          type="button"
          onClick={() => focusField(textInputRef)}
        >
          Start With Text
        </button>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={uploadFiles}
        disabled={uploading}
        hidden
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={uploadFiles}
        disabled={uploading}
        hidden
      />

      {message ? (
        <div className={Object.keys(errors).length ? styles.errorNotice : styles.successNotice}>
          {message}
        </div>
      ) : null}

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h2>Master Content</h2>
          <p>Shared source material and defaults for future platform versions.</p>
        </div>

        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span className={styles.label}>Client</span>
            <select
              className={styles.select}
              value={form.clientId}
              onChange={(event) => changeClient(event.target.value)}
              required
            >
              <option value="">Choose a client</option>
              {clients.map((client) => (
                <option key={client._id} value={client._id}>
                  {client.name}
                </option>
              ))}
            </select>
            {errors.clientId ? <span className={styles.fieldError}>{errors.clientId}</span> : null}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Internal title</span>
            <input
              className={styles.input}
              value={form.internalTitle}
              onChange={(event) => update("internalTitle", event.target.value)}
              placeholder="A clear title used inside the app"
              required
            />
            {errors.internalTitle ? (
              <span className={styles.fieldError}>{errors.internalTitle}</span>
            ) : null}
          </label>

          <label className={styles.fieldFull}>
            <span className={styles.label}>Link to Share (optional)</span>
            <input
              ref={linkInputRef}
              className={styles.input}
              type="url"
              value={form.primaryUrl}
              onChange={(event) => update("primaryUrl", event.target.value)}
              placeholder="https://example.com/article"
              aria-describedby="link-to-share-help"
            />
            <span className={styles.fieldHint} id="link-to-share-help">
              The article, webpage, video, event, or other destination this content should point to.
            </span>
            {errors.primaryUrl ? (
              <span className={styles.fieldError}>{errors.primaryUrl}</span>
            ) : null}
          </label>

          <label className={styles.fieldFull}>
            <span className={styles.label}>Source text</span>
            <textarea
              ref={textInputRef}
              className={styles.textarea}
              value={form.text}
              onChange={(event) => update("text", event.target.value)}
              placeholder="Write or paste the source message here."
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Content length</span>
            <select
              className={styles.select}
              value={form.contentLength}
              onChange={(event) => update("contentLength", event.target.value)}
            >
              <option value="short">Short-form</option>
              <option value="long">Long-form</option>
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Default release date and time</span>
            <input
              className={styles.input}
              type="datetime-local"
              value={form.defaultReleaseAt}
              onChange={(event) => update("defaultReleaseAt", event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeader}>
          <h2>Media</h2>
          <p>Original files upload directly to the private media bucket and remain reusable.</p>
        </div>

        <div className={styles.uploadZone}>
          <div>
            <strong>Add images or video</strong>
            <p>Selecting a file starts its secure upload immediately.</p>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={uploadFiles}
              disabled={uploading}
            />
          </div>
        </div>

        {media.length ? (
          <div className={styles.mediaList}>
            {media.map((asset, index) => (
              <div className={styles.mediaItem} key={asset._id || asset.localId}>
                <div className={styles.mediaPreview}>
                  {asset.contentType?.startsWith("video/") ? (
                    <video src={asset.previewUrl} muted preload="metadata" />
                  ) : (
                    <img src={asset.previewUrl} alt="" />
                  )}
                </div>
                <div className={styles.mediaMeta}>
                  <strong>{asset.originalName}</strong>
                  <span>
                    {formatBytes(asset.size)}
                    {asset.width && asset.height
                      ? ` · ${asset.width} × ${asset.height} · ${asset.orientation}`
                      : ""}
                    {asset.duration ? ` · ${asset.duration.toFixed(1)} seconds` : ""}
                  </span>
                  {asset.status === "error" ? (
                    <span className={styles.fieldError}>{asset.error}</span>
                  ) : asset.progress < 100 ? (
                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressBar}
                        style={{ width: `${asset.progress}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                <div className={styles.mediaActions}>
                  <button
                    className={styles.buttonGhost}
                    type="button"
                    onClick={() => moveMedia(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${asset.originalName} earlier`}
                  >
                    Up
                  </button>
                  <button
                    className={styles.buttonGhost}
                    type="button"
                    onClick={() => moveMedia(index, 1)}
                    disabled={index === media.length - 1}
                    aria-label={`Move ${asset.originalName} later`}
                  >
                    Down
                  </button>
                  <button
                    className={styles.buttonDanger}
                    type="button"
                    onClick={() => removeMedia(index)}
                  >
                    Detach
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {defaultMediaOptions.length ? (
          <label className={styles.field} style={{ marginTop: 16 }}>
            <span className={styles.label}>Default primary media</span>
            <select
              className={styles.select}
              value={form.defaultPrimaryMediaId}
              onChange={(event) => update("defaultPrimaryMediaId", event.target.value)}
            >
              <option value="">Use the first attached asset</option>
              {defaultMediaOptions.map((asset) => (
                <option key={asset._id} value={asset._id}>
                  {asset.originalName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section className={styles.formSection}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.reusable}
            onChange={(event) => update("reusable", event.target.checked)}
          />
          <span>
            <strong>Save for reuse</strong>
            <span>Create a fresh content package from this source later without copying old approvals or schedules.</span>
          </span>
        </label>
      </section>

      <div className={styles.formActions}>
        <Link className={styles.buttonSecondary} href="/content">
          Back to Content
        </Link>
        <button
          className={styles.button}
          type="submit"
          disabled={pending || uploading}
        >
          {pending ? "Saving" : isEditing ? "Save Changes" : "Save Master Content"}
        </button>
      </div>
      {isEditing ? (
        <section className={styles.dangerZone}>
          <div>
            <strong>Delete Master Content</strong>
            <p>
              Permanently deletes this Content package. Uploaded media remains in
              private storage so files are never silently removed.
            </p>
          </div>
          <button
            className={styles.buttonDangerStrong}
            type="button"
            onClick={deleteMasterContent}
            disabled={pending || uploading || deleting}
          >
            {deleting ? "Deleting Content" : "Delete Content"}
          </button>
        </section>
      ) : null}
    </form>
  );
}
