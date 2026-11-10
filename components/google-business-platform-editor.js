"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/ui.module.css";
import GoogleBusinessPublishControls from "@/components/google-business-publish-controls";
import PlatformIcon from "@/components/platform-icon";
import { MediaThumbnail } from "@/components/media-choice";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import {
  GOOGLE_BUSINESS_CTA_TYPES,
  isGoogleBusinessVersionOutOfSync,
  googleBusinessImageCompatible,
  validateGoogleBusinessDraft,
} from "@/lib/google-business-post-logic";

const CTA_LABELS = {
  BOOK: "Book", ORDER: "Order", SHOP: "Shop", LEARN_MORE: "Learn more",
  SIGN_UP: "Sign up", CALL: "Call",
};
const stringId = (value) => String(value || "");
function draftFromVersion(version) {
  return {
    summary: String(version?.summary || ""),
    ctaType: String(version?.ctaType || ""),
    ctaUrl: String(version?.ctaUrl || ""),
    mediaIds: (version?.mediaIds || []).map(stringId),
    releaseSource: version?.releaseSource === "destination_override" ? "destination_override" : "master",
    destinationLocalDateTime: String(version?.destinationLocalDateTime || ""),
  };
}
function GooglePreview({ business, form, image }) {
  const cta = CTA_LABELS[form.ctaType];
  return (
    <aside aria-label="Approximate Google Business Profile post preview"
      style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", minWidth: 0 }}>
      <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--line)" }}>
        <div aria-hidden="true" style={{ borderRadius: "50%", width: 42, height: 42, display: "grid", placeItems: "center", background: "#e9f0fc" }}>
          <PlatformIcon platform="google_business_profile" />
        </div>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", overflowWrap: "anywhere" }}>{business}</strong>
          <small>Google Business Profile · Update preview</small>
        </div>
      </div>
      {image ? (
        <img src={image.previewUrl || "/api/media/" + image._id + "/url"}
          alt={image.originalName || "Selected post photo"}
          style={{ display: "block", maxHeight: 300, width: "100%", objectFit: "cover" }} />
      ) : null}
      <div style={{ padding: 16 }}>
        <p style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.5 }}>
          {form.summary || "Your business update will appear here."}
        </p>
        {cta ? (
          <div style={{ marginTop: 16, display: "inline-block", border: "1px solid #ced8e6",
            padding: "9px 16px", borderRadius: 7, color: "#174ea6", fontWeight: 600 }}>
            {cta}
          </div>
        ) : null}
      </div>
      <div className={styles.fieldHint} style={{ padding: "10px 16px", borderTop: "1px solid var(--line)" }}>
        Approximate layout only. Google controls the final display and review.
      </div>
    </aside>
  );
}

export function GoogleBusinessVersionEditor({ initialVersion, destination, masterContent }) {
  const router = useRouter();
  const [version, setVersion] = useState(initialVersion);
  const [form, setForm] = useState(() => draftFromVersion(initialVersion));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useUnsavedChanges(dirty);
  const media = useMemo(() => masterContent.media || [], [masterContent.media]);
  const masterChanged = isGoogleBusinessVersionOutOfSync(version, masterContent.revision);
  const validation = useMemo(() => validateGoogleBusinessDraft({
    ...form, masterChanged, customized: version.customized === true,
  }, media), [form, masterChanged, media, version.customized]);
  const selectedImage = media.find((asset) => stringId(asset._id) === form.mediaIds[0]) || null;
  const business = version.destinationName || destination?.accountName || "Google Business location";
  const locationId = version.providerAccountId || destination?.providerAccountId || "";
  const readOnly = Boolean(version.googlePublishLock || version.publishedRevision);
  const available = destination?.healthStatus === "healthy" &&
    destination?.providerAccountId === version.providerAccountId;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
    setMessage("");
    setError("");
  }
  function selectCTA(next) {
    setForm((current) => ({
      ...current, ctaType: next,
      ctaUrl: (!next || next === "CALL") ? "" : current.ctaUrl,
    }));
    setDirty(true);
    setMessage("");
    setError("");
  }
  async function requestUpdate(payload) {
    const response = await fetch("/api/platform-versions/" + version._id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to save Google Business draft.");
    return result.platformVersion;
  }
  async function save() {
    if (!available || !validation.saveable) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const saved = await requestUpdate(form);
      setVersion(saved);
      setForm(draftFromVersion(saved));
      setDirty(false);
      setMessage("Google Business Profile draft saved. Nothing has been published or scheduled.");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }
  async function reset() {
    if ((version.customized || dirty) &&
      !window.confirm("Replace Google-specific edits with current shared content?")) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const saved = await requestUpdate({ action: "reset_from_master" });
      setVersion(saved);
      setForm(draftFromVersion(saved));
      setDirty(false);
      setMessage("Google draft updated from shared content.");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  return (
    <section className={styles.platformEditor} data-platform="google_business_profile">
      <div className={styles.sectionHeader}>
        <div className={styles.platformHeading}>
          <PlatformIcon platform="google_business_profile" />
          <h2>Google Business Profile · {business}</h2>
        </div>
        <p>{version.customized ? "Customized for this location" : "Using shared content"} · Standard update draft</p>
        <p className={styles.fieldHint}>Location: {locationId}</p>
      </div>
      {!available ? <div className={styles.errorNotice}>
        This Google location is no longer Healthy or its saved identity changed. Reconnect the correct location before editing.
      </div> : null}
      <div className={styles.notice}>
        Text and one JPG/PNG photo can be submitted after confirmation. Google checks posting access before submission. Scheduling is not enabled yet.
      </div>
      {masterChanged ? <div className={styles.notice}>
        <strong>Shared content changed.</strong> Your existing Google version is preserved.
        Choose Update from shared content to deliberately replace its fields.
      </div> : null}
      {error ? <div role="alert" className={styles.errorNotice}>{error}</div> : null}
      {message ? <div role="status" className={styles.successNotice}>{message}</div> : null}
      {validation.blocking.length ? <div className={styles.errorNotice} role="status">
        <strong>Draft checks</strong>
        <ul style={{ margin: "8px 0 0 18px" }}>{validation.blocking.map((item) => <li key={item}>{item}</li>)}</ul>
      </div> : <div className={styles.editorReady}>{dirty ? "Unsaved changes" : "Saved draft"}</div>}
      <div className={styles.composerColumns}>
        <div>
          <details className={styles.editorContentDetails} open>
            <summary>Standard update content</summary>
            <fieldset className={styles.editorFieldset} disabled={saving || !available || readOnly}>
              <div className={styles.fieldGrid}>
                <label className={styles.fieldFull}>
                  <span className={styles.label}>Update summary</span>
                  <textarea className={styles.textarea} value={form.summary}
                    placeholder="Write an update for this business"
                    onChange={(event) => update("summary", event.target.value)} />
                  <span className={styles.fieldHint}>{[...form.summary].length} / 1,500 characters (conservative draft guard)</span>
                </label>
                <label className={styles.fieldFull}>
                  <span className={styles.label}>Action button (optional)</span>
                  <select className={styles.select} value={form.ctaType}
                    onChange={(event) => selectCTA(event.target.value)}>
                    <option value="">No button</option>
                    {GOOGLE_BUSINESS_CTA_TYPES.map((action) =>
                      <option value={action} key={action}>{CTA_LABELS[action]}</option>)}
                  </select>
                </label>
                {form.ctaType && form.ctaType !== "CALL" ? (
                  <label className={styles.fieldFull}>
                    <span className={styles.label}>Button destination URL</span>
                    <input className={styles.input} type="url" value={form.ctaUrl}
                      placeholder="https://example.com" onChange={(event) => update("ctaUrl", event.target.value)} />
                  </label>
                ) : null}
              </div>
              <div className={styles.sectionHeader} style={{ marginTop: 20 }}>
                <h3>Photo (optional)</h3>
                <p>Choose one attached JPG/PNG image. Videos, multiple images and offers/events are not supported here.</p>
              </div>
              <div className={styles.mediaChoiceGrid}>
                <label className={styles.mediaSelection}>
                  <input type="radio" name={"google-photo-" + version._id}
                    checked={form.mediaIds.length === 0}
                    onChange={() => update("mediaIds", [])} />
                  <span>No photo</span>
                </label>
                {media.map((asset) => {
                  const compatible = googleBusinessImageCompatible(asset);
                  const id = stringId(asset._id);
                  return <label className={styles.mediaSelection} key={id}>
                    <input type="radio" name={"google-photo-" + version._id} disabled={!compatible}
                      checked={form.mediaIds[0] === id}
                      onChange={() => update("mediaIds", [id])} />
                    <MediaThumbnail asset={asset} />
                    <span><strong>{asset.originalName || "Uploaded image"}</strong>
                      <span>{compatible ? "Google-compatible photo" : "Not compatible with Google updates"}</span>
                    </span>
                  </label>;
                })}
              </div>
              <details style={{ marginTop: 20 }}>
                <summary>Future release preference (draft metadata only)</summary>
                <div className={styles.fieldGrid} style={{ marginTop: 12 }}>
                  <label className={styles.fieldFull}>
                    <span className={styles.label}>Release setting</span>
                    <select className={styles.select} value={form.releaseSource}
                      onChange={(event) => update("releaseSource", event.target.value)}>
                      <option value="master">Use shared release time</option>
                      <option value="destination_override">Use a different time for this location</option>
                    </select>
                  </label>
                  {form.releaseSource === "destination_override" ? (
                    <label className={styles.fieldFull}>
                      <span className={styles.label}>Local release time · {masterContent.clientTimezone || "client timezone"}</span>
                      <input type="datetime-local" className={styles.input}
                        value={form.destinationLocalDateTime}
                        onChange={(event) => update("destinationLocalDateTime", event.target.value)} />
                    </label>
                  ) : <p className={styles.fieldHint}>Shared default: {masterContent.defaultReleaseAt || "Not set"}</p>}
                </div>
                <p className={styles.fieldHint}>This preference is saved only. No schedule is created.</p>
              </details>
              <div className={styles.formActions}>
                <button className={styles.buttonSecondary} type="button" onClick={reset} disabled={saving || !available || readOnly}>
                  {masterChanged ? "Update from shared content" : "Reset to shared content"}
                </button>
                <button className={styles.button} type="button" onClick={save}
                  disabled={saving || !available || !dirty || !validation.saveable}>
                  {saving ? "Saving…" : dirty ? "Save Google draft" : "Saved"}
                </button>
              </div>
            </fieldset>
          </details>
        </div>
        <GooglePreview business={business} form={form} image={selectedImage} />
      </div>
      <GoogleBusinessPublishControls version={version} form={form} masterContent={masterContent}
        dirty={dirty} busy={saving || !available} onChange={setVersion} />
    </section>
  );
}
