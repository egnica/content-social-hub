"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PlatformIcon from "@/components/platform-icon";
import LinkedInPublishControls from "@/components/linkedin-publish-controls";
import DestinationScheduleControls from "@/components/facebook-schedule-controls";
import DestinationPublishingPanel from "@/components/destination-publishing-panel";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import styles from "@/components/ui.module.css";
import { isLinkedInVersionOutOfSync, validateLinkedInVersionDraft } from "@/lib/platform-version-logic";

const draft = (v) => ({ message: v.message || "", destinationUrl: v.destinationUrl || "", mediaIds: (v.mediaIds || []).map(String) });
export function LinkedInVersionEditor({ initialVersion, destination, masterContent }) {
  const router = useRouter();
  const [version, setVersion] = useState(initialVersion);
  const [form, setForm] = useState(() => draft(initialVersion));
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
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
  const published = Number(version.publishedRevision || 0) === Number(version.revision || 1);
  const publishAttention = ["submitting", "processing", "unknown"].includes(
    String(version.lastPublishStatus || "").toLowerCase(),
  );
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
          <fieldset className={styles.fieldFull} style={{border:"1px solid #d8dde3",borderRadius:8,padding:12}}>
            <legend className={styles.label}>LinkedIn media (up to 20 images or one MP4 video)</legend>
            {media.filter((asset)=>/^(image\/(jpeg|png|gif)|video\/mp4)$/.test(asset.contentType||"")).map((asset)=>{
              const id=String(asset._id);
              const checked=form.mediaIds.includes(id);
              const isVideo=asset.contentType==="video/mp4";
              const hasVideo=media.some((a)=>form.mediaIds.includes(String(a._id))&&a.contentType==="video/mp4");
              return <label key={id} style={{display:"block",margin:"8px 0"}}>
                <input type="checkbox" checked={checked}
                  disabled={!checked&&(form.mediaIds.length>=20||hasVideo||(isVideo&&form.mediaIds.length>0))}
                  onChange={(event)=>update("mediaIds",event.target.checked?[...form.mediaIds,id]:form.mediaIds.filter((x)=>x!==id))} />
                {" "}{asset.originalName||"Attached media"} {isVideo?"(video)":"(image)"}
              </label>;
            })}
          </fieldset>
        </div>
        <p className={styles.fieldHint}>Multi-image is an organic post with 2–20 images, not a LinkedIn carousel ad. A video must be selected alone.</p>
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
          {selected?.contentType==="video/mp4" ? <p style={{padding:16}}>Video selected: {selected.originalName || "MP4 video"}</p> : null}
          {form.mediaIds.length>1 ? <p style={{padding:16}}>Multi-image post · {form.mediaIds.length} images</p> : null}
          {form.destinationUrl ? <div style={{padding:16,background:"#f5f7f9",overflowWrap:"anywhere"}}>Link: {form.destinationUrl}</div> : null}
        </div>
      </div>
    </div>
    <DestinationPublishingPanel
      published={published}
      attention={publishAttention}
      destinationName={accountName}
      schedule={
        <div>
          <p className={styles.fieldHint}>
            Schedule text, links, up to 20 images, or one MP4 video.
            Video processing can delay when the post appears.
          </p>
          <DestinationScheduleControls
            version={version}
            destination={destination}
            masterContent={masterContent}
            dirty={dirty}
            busy={busy}
          />
        </div>
      }
      publish={
        <LinkedInPublishControls
          version={version}
          destination={destination}
          form={form}
          media={media}
          dirty={dirty}
          busy={busy}
          timezone={masterContent.clientTimezone}
          onPublished={handlePublished}
        />
      }
    />
  </section>;
}
