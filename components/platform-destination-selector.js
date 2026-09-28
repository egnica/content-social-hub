"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/ui.module.css";

function activeConnectionIds(platformVersions) {
  return platformVersions
    .filter((version) => version.active !== false)
    .map((version) => version.socialConnectionId);
}

function destinationStatus(destination) {
  if (destination.selectable) return "Healthy · ready for a platform version";
  if (destination.healthMessage) return destination.healthMessage;
  if (!destination.canPublish) return "Facebook publishing permission is unavailable.";
  return `Account Health: ${destination.healthStatus || "unavailable"}`;
}

export default function PlatformDestinationSelector({
  contentId,
  clientName,
  destinations,
  initialPlatformVersions,
}) {
  const router = useRouter();
  const [platformVersions, setPlatformVersions] = useState(initialPlatformVersions);
  const [selectedIds, setSelectedIds] = useState(() =>
    activeConnectionIds(initialPlatformVersions),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

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
        throw new Error(result.error || "Unable to save publishing destinations.");
      }

      setPlatformVersions(result.platformVersions || []);
      setSelectedIds(activeConnectionIds(result.platformVersions || []));
      setMessage("Destinations saved. Nothing has been published to Facebook.");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.formCard} style={{ marginTop: 20 }}>
      <div className={styles.sectionHeader}>
        <h2>Publishing Destinations</h2>
        <p>
          Choose the connected Facebook Page(s) that should receive a platform
          version for {clientName}. This only prepares the destination; it does
          not publish anything.
        </p>
      </div>

      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {message ? <div className={styles.successNotice}>{message}</div> : null}

      {destinations.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          {destinations.map((destination) => {
            const checked = selectedSet.has(destination._id);
            const disabled = !destination.selectable && !checked;

            return (
              <label className={styles.checkboxRow} key={destination._id}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled || saving}
                  onChange={(event) =>
                    toggleDestination(destination._id, event.target.checked)
                  }
                />
                <span>
                  <strong>{destination.accountName}</strong>
                  <span>
                    Facebook Page · {destinationStatus(destination)}
                    {checked && platformVersions.some(
                      (version) =>
                        version.socialConnectionId === destination._id &&
                        version.active !== false,
                    )
                      ? " · version saved"
                      : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className={styles.notice}>
          No Facebook Page is connected to this client yet. Add one in{" "}
          <Link href="/connections">Social Accounts</Link> before creating a
          platform version.
        </div>
      )}

      <div className={styles.formActions}>
        <button
          className={styles.button}
          type="button"
          onClick={saveDestinations}
          disabled={saving}
        >
          {saving ? "Saving Destinations" : "Save Destinations"}
        </button>
      </div>
    </section>
  );
}
