"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PlatformIcon from "@/components/platform-icon";
import LinkedInPublishControls from "@/components/linkedin-publish-controls";
import styles from "@/components/ui.module.css";
import { isLinkedInVersionOutOfSync, validateLinkedInVersionDraft } from "@/lib/platform-version-logic";

const draft = (v) => ({ message: v.message || "", destinationUrl: v.destinationUrl || "", mediaIds: (v.mediaIds || []).map(String) });
export function LinkedInVersionEditor({ initialVersion, destination, masterContent }) {
  const router = useRouter();
  const [version, setVersion] = useState(initialVersion);
  const [form, setForm] = useState(() => draft(initialVersion));
  const [dirty, setDirty] = useState(false);
  const published = version.publishedRevision === version.revision && version.lastPublishStatus === "succeeded";
  function handlePublished(saved) { setVersion(saved); setForm(draft(saved)); setDirty(false); router.refresh(); }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const media = useMemo(() => masterContent.media || [], [masterContent.media]);
  const outOfSync = isLinkedInVersionOutOfSync(version, masterContent.revision);
  const validation = validateLinkedInVersionDraft({ ...form, media, masterChanged: outOfSync,
    customized: version.customized, healthStatus: destination?.healthStatus,
    canPublish: destination?.canPublish });
  const selected = media.find((asset) => form.mediaIds.includes(String(asset._id)));
  const accountName = version.destinationName || destination?.accountName || "LinkedIn profile";
  const update = (key, value) => { setForm((prev) => ({...prev,[key]:value})); setDirty(true); setError(""); setMessage(""); };
  async function save(payload, reset = false) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/platform-versions/${version._id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save LinkedIn draft.");
      setVersion(body.platformVersion); setForm(draft(body.platformVersion)); setDirty(false);
      setMessage(reset ? "Updated from shared content." : "LinkedIn draft saved. Nothing was published.");
      router.refresh();
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className={styles.platformEditor} data-platform="linkedin">
    <div className={styles.sectionHeader}>
      <div className={styles.platformHeading}><PlatformIcon platform="linkedin" /><h2>LinkedIn · {accountName}</h2></div>
      <p>{version.customized ? "Customized for LinkedIn" : "Using shared content"}</p>
    </div>
    {error ? <div className={styles.errorNotice}>{error}</div> : null}
    {message ? <div className={styles.successNotice}>{message}</div> : null}
    {outOfSync ? <div className={styles.notice}>Master content changed. LinkedIn edits are preserved until you choose Update from Master.</div> : null}
    {validation.blocking.length ? <div className={styles.errorNotice}>
      <strong>Draft validation</strong><ul>{validation.blocking.map((item)=><li key={item}>{item}</li>)}</ul>
    </div> : <div className={styles.editorReady}>{dirty ? "Unsaved changes" : "Saved draft"}</div>}
    <div className={styles.composerColumns}>
      <div>
        <div className={styles.fieldGrid}>
          <label className={styles.fieldFull}><span className={styles.label}>LinkedIn post text</span>
            <textarea className={styles.textarea} value={form.message} onChange={(event)=>update("message",event.target.value)}/></label>
          <label className={styles.fieldFull}><span className={styles.label}>Link to share (optional)</span>
            <input className={styles.input} type="url" value={form.destinationUrl} placeholder="https://example.com"
              onChange={(event)=>update("destinationUrl",event.target.value)} /></label>
          <label className={styles.fieldFull}><span className={styles.label}>Attached image (optional)</span>
            <select className={styles.select} value={form.mediaIds[0] || ""} onChange={(event)=>update("mediaIds",event.target.value ? [event.target.value] : [])}>
              <option value="">No image</option>
              {media.filter((asset)=>asset.contentType?.startsWith("image/")).map((asset)=>
                <option key={String(asset._id)} value={String(asset._id)}>{asset.originalName || "Image"}</option>)}
            </select>
          </label>
        </div>
        <p className={styles.fieldHint}>Video and carousel LinkedIn drafts are not supported yet.</p>
        <div className={styles.formActions}>
          <button className={styles.buttonSecondary} type="button" disabled={busy}
            onClick={()=>{if((dirty || version.customized) && !window.confirm("Replace LinkedIn edits with Master Content?")) return; save({action:"reset_from_master"},true);}}>Update from Master</button>
          <button className={styles.button} type="button" disabled={busy || !dirty || validation.blocking.length > 0}
            onClick={()=>save(form)}>{busy ? "Saving…" : dirty ? "Save LinkedIn Version" : "Saved"}</button>
        </div>
      </div>
      <div><div className={styles.sectionHeader}><h2>LinkedIn Preview</h2><p>Approximate draft only</p></div>
        <div style={{border:"1px solid #d8dde3", borderRadius:12, overflow:"hidden", background:"#fff"}}>
          <div style={{padding:16,display:"flex",gap:12,alignItems:"center"}}>
            {destination?.pictureUrl ? <img src={destination.pictureUrl} alt="" width={42} height={42} style={{borderRadius:"50%"}} /> : null}
            <div><strong>{accountName}</strong><div className={styles.fieldHint}>Personal profile · Draft</div></div>
          </div>
          <p style={{whiteSpace:"pre-wrap",padding:16,overflowWrap:"anywhere"}}>{form.message || "Your LinkedIn post text"}</p>
          {selected && selected.contentType?.startsWith("image/") ?
            <img src={selected.previewUrl || `/api/media/${selected._id}/url`} alt="" style={{display:"block",width:"100%",maxHeight:400,objectFit:"contain"}}/> : null}
          {form.destinationUrl ? <div style={{padding:16,background:"#f5f7f9",overflowWrap:"anywhere"}}>Link: {form.destinationUrl}</div> : null}
        </div>
      </div>
    </div>
    <LinkedInPublishControls version={version} destination={destination} form={form} media={media}
      dirty={dirty} busy={busy} timezone={masterContent.clientTimezone} onPublished={handlePublished} />
    <div className={styles.notice}>LinkedIn background scheduling is not enabled yet.</div>
  </section>;
}
