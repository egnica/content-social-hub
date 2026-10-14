"use client";

import { useState } from "react";
import styles from "@/components/ui.module.css";

export default function DestinationPublishingPanel({
  published,
  attention,
  destinationName,
  schedule,
  publish,
  nowLabel = "Publish now",
}) {
  const [mode, setMode] = useState("schedule");
  const activeMode = attention ? "now" : mode;
  return (
    <section
      className={styles.publishingPanel}
      aria-label={`Publishing for ${destinationName}`}
    >
      {!published && !attention ? (
        <div className={styles.publishingPanelHeader}>
          <div>
            <h2>When should it go out?</h2>
            <p>
              {destinationName} only. Other accounts keep their own schedules.
            </p>
          </div>
          <div className={styles.timingSwitch} aria-label="Publish timing">
            <button
              type="button"
              aria-pressed={activeMode === "now"}
              onClick={() => setMode("now")}
            >
              {nowLabel}
            </button>
            <button
              type="button"
              aria-pressed={activeMode === "schedule"}
              onClick={() => setMode("schedule")}
            >
              Schedule
            </button>
          </div>
        </div>
      ) : null}
      <div hidden={published || activeMode !== "schedule"}>{schedule}</div>
      <div hidden={!published && activeMode !== "now"}>{publish}</div>
    </section>
  );
}
