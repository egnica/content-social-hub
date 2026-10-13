"use client";
import { useEffect, useState } from "react";
import styles from "@/components/ui.module.css";
import PublishedPostSummary from "@/components/published-post-summary";
import { getInstagramPublishControlState, isInstagramAttemptForRevision } from "@/lib/instagram-publish-logic";
import { validateLinkedInPublishDraft, linkedinPostUrl } from "@/lib/linkedin-publish-logic";

export default function LinkedInPublishControls({version,destination,form,media,dirty,busy,onPublished,timezone}) {
  const [attempts,setAttempts]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const destinationName=version.destinationName||destination?.accountName||"LinkedIn profile";
  const selected=(media||[]).filter(a=>(form.mediaIds||[]).includes(String(a._id)));
  const validation=validateLinkedInPublishDraft({
    ...form,mediaAssets:selected,
    healthStatus:destination?.healthStatus,canPublish:destination?.canPublish===true,
  });
  const current=attempts.find(a=>isInstagramAttemptForRevision(a,version.revision));
  const state=getInstagramPublishControlState({
    status:current?.status||version.lastPublishStatus,
    publishedRevision:version.publishedRevision,revision:version.revision,
  });
  const postUrl=current?.providerPostUrl||version.providerPostUrl||
    linkedinPostUrl(current?.providerPostId||version.providerPostId);
  async function refresh() {
    const response=await fetch(`/api/platform-versions/${version._id}/publish-attempts`,{cache:"no-store"});
    const body=await response.json();
    if(!response.ok) throw new Error(body.error||"Could not load LinkedIn publish history.");
    setAttempts(body.attempts||[]);
  }
  useEffect(()=>{
    let cancelled=false;
    fetch(`/api/platform-versions/${version._id}/publish-attempts`,{cache:"no-store"})
      .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.error||"Unable to load history.");return body;})
      .then(body=>{if(!cancelled){setAttempts(body.attempts||[]);setLoaded(true);}})
      .catch(e=>{if(!cancelled){setError(e.message);setLoaded(true);}});
    return ()=>{cancelled=true;};
  },[version._id,version.revision]);
  async function publishNow(){
    setError("");setNotice("");
    if(dirty||busy||!validation.publishable||!state.canSubmit)return;
    const confirmation=[
      `Publish this LinkedIn post to ${destinationName}?`,"",
      "Text:",form.message||"(none)","",
      "Link:",form.destinationUrl||"(none)","",
      "Media:",selected.map((asset)=>asset.originalName||"Attached media").join(", ")||"(none)","",
      "This will create a real public LinkedIn personal-profile post.",
    ].join("\n");
    if(!window.confirm(confirmation))return;
    setSubmitting(true);
    try{
      const response=await fetch(`/api/platform-versions/${version._id}/publish`,{method:"POST"});
      const result=await response.json();
      await refresh();
      if(!response.ok)throw new Error(result.error||"Could not publish this LinkedIn post.");
      onPublished?.(result.platformVersion,result.attempt);
      setNotice("Published live to LinkedIn.");
    }catch(e){setError(e.message);}finally{setSubmitting(false);}
  }
  return <section className={styles.platformEditor} aria-label="LinkedIn publishing">
    {state.mode==="published" ? <PublishedPostSummary
      platformLabel="LinkedIn" destinationName={destinationName} version={version}
      attempt={current} postUrl={postUrl} timezone={timezone} /> : null}
    {state.mode!=="published" ? <>
      <div className={styles.sectionHeader}><h2>Publish Now</h2>
        <p>Publish this saved revision to {destinationName}.</p></div>
      {dirty?<div className={styles.notice}>Save the LinkedIn version before publishing.</div>:null}
      {state.mode==="locked"||state.mode==="processing"?
        <div className={styles.errorNotice}>LinkedIn may already have this post. Review Publish History before trying again. Duplicate publishing is blocked.</div>:null}
      {state.mode==="retry"?<div className={styles.notice}>The previous attempt failed before submission. Retry is available.</div>:null}
      {validation.blocking.length?<div className={styles.errorNotice}><strong>Publish blocked</strong>
        <ul>{validation.blocking.map(t=><li key={t}>{t}</li>)}</ul></div>:null}
      <div className={styles.formActions}>
        <button type="button" className={styles.button}
          disabled={busy||dirty||submitting||!loaded||!validation.publishable||!state.canSubmit}
          onClick={publishNow}>{submitting?"Publishing…":state.label}</button>
      </div>
    </>:null}
    {error?<div className={styles.errorNotice}>{error}</div>:null}
    {notice?<div className={styles.successNotice}>{notice}</div>:null}
    <details className={styles.publishHistory}>
      <summary>Publishing activity</summary>
      {attempts.length?attempts.map(a=><div key={a._id} className={styles.notice}>
        <strong>{a.status==="unknown"?"Review required":a.status}</strong>
        {" · Revision "}{a.platformVersionRevision}
        {a.providerError?.message?<p>{a.providerError.message}</p>:null}
        {a.providerPostUrl||linkedinPostUrl(a.providerPostId)?
          <p><a className={styles.buttonSecondary} target="_blank" rel="noreferrer"
            href={a.providerPostUrl||linkedinPostUrl(a.providerPostId)}>View Post ↗</a></p>:null}
      </div>):<p>No LinkedIn publish attempts yet.</p>}
    </details>
  </section>;
}
