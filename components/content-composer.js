"use client";

import { useState } from "react";
import MasterContentForm from "@/components/master-content-form";
import PlatformDestinationSelector from "@/components/platform-destination-selector";
import PlatformIcon from "@/components/platform-icon";
import { FacebookVersionEditor } from "@/components/facebook-platform-editor";
import { InstagramVersionEditor } from "@/components/instagram-platform-editor";
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
      ["facebook", "instagram"].includes(version.platform),
  );
  const [selectedTab, setSelectedTab] = useState(
    activeVersions[0]?._id || "shared",
  );
  const activeTab =
    selectedTab === "shared" ||
    activeVersions.some((version) => version._id === selectedTab)
      ? selectedTab
      : "shared";
  const sharedPanelId = "composer-shared";

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
        destinations={destinations}
        initialPlatformVersions={platformVersions}
        scheduleStates={scheduleStates}
      />
      <div className={styles.composerSurface}>
        <div
          className={styles.composerTabs}
          role="tablist"
          aria-label="Post versions"
          onKeyDown={handleTabKeys}
        >
          <button
            type="button"
            className={styles.composerTab}
            id="tab-shared"
            role="tab"
            aria-controls={sharedPanelId}
            aria-selected={activeTab === "shared"}
            tabIndex={activeTab === "shared" ? 0 : -1}
            onClick={() => setSelectedTab("shared")}
          >
            <span>Shared content</span>
            <small>Text, link & media</small>
          </button>
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
                  {version.platform === "instagram" ? "Instagram" : "Facebook"}
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
        <div
          id={sharedPanelId}
          role="tabpanel"
          aria-labelledby="tab-shared"
          hidden={activeTab !== "shared"}
        >
          <MasterContentForm clients={clients} content={content} />
        </div>
        {activeVersions.map((version) => {
          const destination = destinations.find(
            (item) => item._id === version.socialConnectionId,
          );
          const Editor =
            version.platform === "instagram"
              ? InstagramVersionEditor
              : FacebookVersionEditor;
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
                key={`${version._id}-${version.revision}-${masterContent.revision}`}
                initialVersion={version}
                destination={destination}
                masterContent={masterContent}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
