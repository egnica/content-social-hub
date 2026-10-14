"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/ui.module.css";
import PlatformIcon from "@/components/platform-icon";
import { composerStatus } from "@/lib/content-composer-logic";
import { useUnsavedChanges } from "@/components/unsaved-changes";

function activeConnectionIds(platformVersions) {
  return platformVersions
    .filter((version) => version.active !== false)
    .map((version) => version.socialConnectionId);
}

function platformLabel(platform) {
  if (platform === "instagram") return "Instagram Professional";
  if (platform === "facebook") return "Facebook Page";
  if (platform === "linkedin") return "LinkedIn personal profile";
  if (platform === "youtube") return "YouTube channel";
  return platform || "Social destination";
}

function destinationStatus(destination) {
  if (destination.selectable) return "Connected";
  if (destination.healthMessage) return destination.healthMessage;
  if (!destination.canPublish) {
    return `${platformLabel(destination.platform)} publishing permission is unavailable.`;
  }
  return `Account Health: ${destination.healthStatus || "unavailable"}`;
}

export default function PlatformDestinationSelector({
  contentId,
  clientName,
  clientId,
  onDirtyChange,
  destinations,
  initialPlatformVersions,
  scheduleStates = {},
}) {
  const router = useRouter();
  const [platformVersions, setPlatformVersions] = useState(
    initialPlatformVersions,
  );
  const [selectedIds, setSelectedIds] = useState(() =>
    activeConnectionIds(initialPlatformVersions),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const dirty = [...selectedIds].sort().join(",") !== activeConnectionIds(platformVersions).sort().join(",");
  useUnsavedChanges(dirty);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);

  function toggleDestination(connectionId, checked) {
    setSelectedIds((current) =>
      checked
        ? [...new Set([...current, connectionId])]
        : current.filter((id) => id !== connectionId),
    );
    setMessage("");
    setError("");
  }

  async function saveDestinations() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/content/${contentId}/destinations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socialConnectionIds: selectedIds }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to save publishing destinations.",
        );
      }

      setPlatformVersions(result.platformVersions || []);
      setSelectedIds(activeConnectionIds(result.platformVersions || []));
      setMessage(
        "Destinations saved. Platform versions were prepared; nothing has been published.",
      );
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.destinationPicker}>
      <div className={styles.sectionHeader}>
        <h2>Posting to</h2>
        <p>
          Choose the accounts for {clientName}. Saving accounts prepares drafts;
          it does not schedule or publish them.
        </p>
      </div>

      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {message ? <div className={styles.successNotice}>{message}</div> : null}

      {destinations.length ? (
        <div className={styles.destinationGrid}>
          {destinations.map((destination) => {
            const checked = selectedSet.has(destination._id);
            const disabled = !destination.selectable && !checked;
            const savedVersion = checked
              ? platformVersions.find(
                  (version) =>
                    version.socialConnectionId === destination._id &&
                    version.active !== false,
                )
              : null;
            const status = savedVersion
              ? composerStatus(savedVersion, scheduleStates[savedVersion._id])
              : "";

            return (
              <label className={styles.destinationCard} key={destination._id}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || saving}
                  onChange={(event) =>
                    toggleDestination(destination._id, event.target.checked)
                  }
                />
                <PlatformIcon platform={destination.platform} />
                <span className={styles.destinationIdentity}>
                  <strong>{destination.accountName}</strong>
                  <span>
                    {platformLabel(destination.platform)} ·{" "}
                    {destinationStatus(destination)}
                  </span>
                </span>
                {savedVersion ? (
                  <span className={styles.composerStatus} data-status={status}>
                    {status}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      ) : (
        <div className={styles.notice}>
          No supported social destination is connected to this
          client yet. Add one in{" "}
          <Link href={clientId ? `/connections?clientId=${clientId}` : "/connections"}>Social Accounts</Link> before creating a
          platform version.
        </div>
      )}

      <div className={styles.formActions}>
        <button
          className={styles.button}
          type="button"
          onClick={saveDestinations}
          disabled={saving || !dirty}
        >
          {saving ? "Saving accounts…" : dirty ? "Save accounts" : selectedIds.length ? "Accounts saved" : "Choose accounts above"}
        </button>
      </div>
    </section>
  );
}
