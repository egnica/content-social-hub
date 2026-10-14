"use client";

import { useRef, useState } from "react";
import MasterContentForm from "@/components/master-content-form";
import PlatformDestinationSelector from "@/components/platform-destination-selector";
import PlatformIcon from "@/components/platform-icon";
import { FacebookVersionEditor } from "@/components/facebook-platform-editor";
import { InstagramVersionEditor } from "@/components/instagram-platform-editor";
import { YouTubeVersionEditor } from "@/components/youtube-platform-editor";
import { LinkedInVersionEditor } from "@/components/linkedin-platform-editor";
import styles from "@/components/ui.module.css";
import { composerStatus } from "@/lib/content-composer-logic";

export default function ContentComposer({
  content,
  clients,
  masterContent,
  destinations,
  platformVersions,
  scheduleStates = {},
}) {
  const activeVersions = platformVersions.filter(
    (version) =>
      version.active !== false &&
      ["facebook", "instagram", "linkedin", "youtube"].includes(version.platform),
  );
  const [selectedTab, setSelectedTab] = useState(activeVersions[0]?._id || "");
  const activeTab = activeVersions.some(
    (version) => version._id === selectedTab,
  )
    ? selectedTab
    : activeVersions[0]?._id || "";

  const [accountsDirty, setAccountsDirty] = useState(false);
  const [sharedDirty, setSharedDirty] = useState(false);
  const [masterOpen, setMasterOpen] = useState(!activeVersions.length);
  const [accountsOpen, setAccountsOpen] = useState(!activeVersions.length);
  const masterRef = useRef(null);
  const accountsRef = useRef(null);
  const postsRef = useRef(null);
  function showSection(section) {
    if (section === "source") setMasterOpen(true);
    if (section === "accounts") setAccountsOpen(true);
    const target = section === "source" ? masterRef : section === "accounts" ? accountsRef : postsRef;
    requestAnimationFrame(() => {
      target.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      (target.current?.querySelector("summary, [role=tab]") || target.current)?.focus();
    });
  }
  const needsAttention = activeVersions.some(version => ["Needs attention", "Review required"].includes(composerStatus(version, scheduleStates[version._id])));
  function handleTabKeys(event) {
    const tabs = Array.from(
      event.currentTarget.querySelectorAll('[role="tab"]'),
    );
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : null;
    if (nextIndex === null) return;
    event.preventDefault();
    tabs[nextIndex].click();
    tabs[nextIndex].focus();
  }

  return (
    <div className={styles.composer}>
      <section className={styles.composerOverview} aria-label="Content workflow">
        <div className={styles.workflowContext}><strong>{content.clientName}</strong><span>Each account has its own post and publishing time.</span></div>
        <nav className={styles.workflowSteps} aria-label="Content steps">
          <button type="button" onClick={() => showSection("source")}><span>1</span><div><strong>Shared content</strong><small>{sharedDirty ? "Unsaved changes" : `${content.media?.length || 0} media · Saved`}</small></div></button>
          <button type="button" onClick={() => showSection("accounts")}><span>2</span><div><strong>Posting accounts</strong><small>{accountsDirty ? "Unsaved selection" : activeVersions.length ? `${activeVersions.length} saved` : "Choose accounts"}</small></div></button>
          <button type="button" disabled={!activeVersions.length} onClick={() => showSection("posts")}><span>3</span><div><strong>Review & publish</strong><small>{needsAttention ? "Needs attention" : activeVersions.length ? "Open account posts" : "Save accounts first"}</small></div></button>
        </nav>
      </section>
      {sharedDirty ? <div className={styles.notice} role="status">Your shared content has unsaved changes. Save it to make those changes available to account posts.</div> : null}
      <details ref={masterRef} className={styles.masterContentCard} open={masterOpen} onToggle={event => setMasterOpen(event.currentTarget.open)}>
        <summary>
          <strong>Shared content</strong>
          <span className={styles.fieldHint}>{sharedDirty ? "Unsaved changes" : "Saved text, link and media"}</span>
          <span className={styles.masterExpanded}>Collapse</span>
          <span className={styles.masterCollapsed}>Expand</span>
        </summary>
        <MasterContentForm
          clients={clients}
          content={content}
          showHeading={false}
          onDirtyChange={setSharedDirty}
        />
      </details>
      <details ref={accountsRef} className={styles.masterContentCard} open={accountsOpen} onToggle={event => setAccountsOpen(event.currentTarget.open)}>
        <summary><strong>Posting accounts</strong><span className={styles.fieldHint}>{accountsDirty ? "Unsaved selection" : activeVersions.length ? `${activeVersions.length} account${activeVersions.length === 1 ? "" : "s"} selected` : "Choose where this content will go"}</span><span className={styles.masterExpanded}>Collapse</span><span className={styles.masterCollapsed}>Choose / change</span></summary>
      <PlatformDestinationSelector
        key={JSON.stringify(
          platformVersions.map((version) => [
            version._id,
            version.active,
            version.revision,
          ]),
        )}
        contentId={content._id}
        clientName={content.clientName}
        clientId={content.clientId}
        onDirtyChange={setAccountsDirty}
        destinations={destinations}
        initialPlatformVersions={platformVersions}
        scheduleStates={scheduleStates}
      />
      </details>
      {activeVersions.length ? (
        <div ref={postsRef} tabIndex={-1} className={styles.composerSurface}>
          <div
            className={styles.composerTabs}
            role="tablist"
            aria-label="Post versions"
            onKeyDown={handleTabKeys}
          >
            {activeVersions.map((version) => (
              <button
                key={version._id}
                type="button"
                className={styles.composerTab}
                data-platform={version.platform}
                id={`tab-${version._id}`}
                role="tab"
                aria-controls={`panel-${version._id}`}
                aria-selected={activeTab === version._id}
                tabIndex={activeTab === version._id ? 0 : -1}
                onClick={() => setSelectedTab(version._id)}
              >
                <PlatformIcon platform={version.platform} />
                <span>
                  <strong>
                    {version.platform === "instagram" ? "Instagram" : version.platform === "linkedin" ? "LinkedIn" : version.platform === "youtube" ? "YouTube" : "Facebook"}
                  </strong>
                  <small>
                    {version.destinationName ||
                      destinations.find(
                        (item) => item._id === version.socialConnectionId,
                      )?.accountName ||
                      "Account"}
                  </small>
                </span>
                <span
                  className={styles.composerStatus}
                  data-status={composerStatus(
                    version,
                    scheduleStates[version._id],
                  )}
                >
                  {composerStatus(version, scheduleStates[version._id])}
                </span>
              </button>
            ))}
          </div>
          {activeVersions.map((version) => {
            const destination = destinations.find(
              (item) => item._id === version.socialConnectionId,
            );
            const Editor =
              version.platform === "youtube"
                ? YouTubeVersionEditor
                : version.platform === "instagram"
                ? InstagramVersionEditor
                : version.platform === "linkedin" ? LinkedInVersionEditor : FacebookVersionEditor;
            return (
              <div
                key={version._id}
                id={`panel-${version._id}`}
                role="tabpanel"
                aria-labelledby={`tab-${version._id}`}
                hidden={activeTab !== version._id}
                data-platform={version.platform}
              >
                <Editor
                  key={`${version._id}-${version.revision}`}
                  initialVersion={version}
                  destination={destination}
                  masterContent={masterContent}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.notice}>
          Choose and save an account above to prepare its post.
        </div>
      )}
    </div>
  );
}
