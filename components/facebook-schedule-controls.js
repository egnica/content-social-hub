"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/ui.module.css";
import {
  evaluateScheduleState,
  resolveScheduleRelease,
} from "@/lib/scheduling-logic";

function wallClockLabel(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Not set";

  const [date, time] = normalized.split("T");
  return time ? `${date} at ${time}` : normalized;
}

function scheduleStateLabel(code) {
  const labels = {
    active_schedule: "Scheduled",
    dispatching: "Publishing",
    stale_content_revision: "Stale schedule",
    already_published_revision: "Already published",
    past_release_time: "Scheduled time passed",
    missed_schedule: "Missed Schedule",
    failed: "Publish failed",
    review_required: "Review required",
    succeeded: "Succeeded",
    cancelled: "Cancelled",
    superseded: "Superseded",
    ready: "Ready to schedule",
  };

  return labels[code] || "Schedule state";
}

function releaseChoiceError(resolved, version, platformLabel) {
  if (!resolved.ok) return resolved.error;

  const evaluation = evaluateScheduleState({
    releaseAt: resolved.releaseAt,
    now: new Date(),
    platformVersionRevision: version.revision,
    currentPlatformVersionRevision: version.revision,
    publishedRevision: version.publishedRevision,
  });

  if (evaluation.valid) return "";

  const messages = {
    past_release_time: "Choose a future release date and time.",
    already_published_revision: `This ${platformLabel} revision has already been published and cannot be scheduled again.`,
  };

  return messages[evaluation.code] || "This release time cannot be scheduled.";
}

function scheduleNeedsAttention(code) {
  return [
    "stale_content_revision",
    "already_published_revision",
    "past_release_time",
    "missed_schedule",
    "failed",
    "review_required",
  ].includes(code);
}

export default function DestinationScheduleControls({
  version,
  destination,
  masterContent,
  dirty,
  busy,
}) {
  const router = useRouter();
  const [scheduleState, setScheduleState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [releaseSource, setReleaseSource] = useState(() =>
    masterContent.defaultReleaseAt &&
    new Date(masterContent.defaultReleaseAt).getTime() > Date.now()
      ? "master"
      : "destination_override",
  );
  const [destinationLocalDateTime, setDestinationLocalDateTime] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const platform = ["facebook", "instagram", "linkedin"].includes(version.platform)
    ? version.platform
    : "facebook";
  const platformLabel = {
    facebook: "Facebook",
    instagram: "Instagram",
    linkedin: "LinkedIn",
  }[platform];
  const destinationName =
    version.destinationName ||
    destination?.accountName ||
    (platform === "instagram"
      ? "Instagram account"
      : platform === "linkedin"
        ? "LinkedIn personal profile"
        : "Facebook Page");
  const clientTimezone =
    scheduleState?.clientTimezone || masterContent.clientTimezone || "";

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/platform-versions/${version._id}/schedule`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || `Unable to load the ${platformLabel} schedule.`,
          );
        }

        const nextState = result.scheduleState || null;
        setScheduleState(nextState);

        if (nextState?.schedule?.active) {
          const source = nextState.schedule.releaseSource || "master";
          setReleaseSource(source);
          setDestinationLocalDateTime(
            source === "destination_override"
              ? nextState.schedule.localDateTime || ""
              : "",
          );
        }
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [
    masterContent.defaultReleaseAt,
    masterContent.defaultReleaseTimezone,
    platformLabel,
    version._id,
    version.publishedRevision,
    version.revision,
  ]);

  const resolvedChoice = useMemo(
    () =>
      resolveScheduleRelease({
        source: releaseSource,
        masterReleaseAt: masterContent.defaultReleaseAt,
        masterReleaseTimezone: masterContent.defaultReleaseTimezone,
        destinationLocalDateTime,
        clientTimezone,
      }),
    [
      clientTimezone,
      destinationLocalDateTime,
      masterContent.defaultReleaseAt,
      masterContent.defaultReleaseTimezone,
      releaseSource,
    ],
  );
  const choiceError = releaseChoiceError(
    resolvedChoice,
    version,
    platformLabel,
  );
  const activeSchedule = scheduleState?.schedule?.active === true;
  const currentSchedule = scheduleState?.schedule || null;
  const serverBlocking = scheduleState?.validation?.blocking || [];
  const schedulingBlocked = Boolean(
    dirty ||
    choiceError ||
    serverBlocking.length ||
    scheduleState?.currentRevisionPublished,
  );
  const canSubmit = activeSchedule
    ? scheduleState?.canReschedule === true
    : scheduleState?.canSchedule === true;

  function changeReleaseSource(value) {
    setReleaseSource(value);
    setMessage("");
    setError("");
  }

  function exactScheduleConfirmation(action) {
    const verb = action === "reschedule" ? "Reschedule" : "Schedule";
    const lines = [
      `${verb} this ${platformLabel} post to ${destinationName}?`,
      "",
      `Date and time: ${wallClockLabel(resolvedChoice.localDateTime)}`,
      `Timezone: ${resolvedChoice.timezone}`,
    ];

    if (action === "reschedule" && currentSchedule) {
      lines.push(
        "",
        `Current scheduled revision: ${currentSchedule.platformVersionRevision}`,
        `Current release: ${wallClockLabel(currentSchedule.localDateTime)} (${currentSchedule.timezone})`,
      );
    }

    lines.push(
      "",
      "This schedules the saved post for this account. Publishing continues when your browser is closed.",
    );

    return lines.join("\n");
  }

  async function saveSchedule() {
    setMessage("");
    setError("");

    if (dirty) {
      setError(`Save the ${platformLabel} version before scheduling it.`);
      return;
    }

    if (choiceError) {
      setError(choiceError);
      return;
    }

    if (serverBlocking.length) {
      setError(serverBlocking.join(" "));
      return;
    }

    const action = activeSchedule ? "reschedule" : "schedule";
    if (!canSubmit) {
      setError(
        scheduleState?.stateCode === "review_required"
          ? `This ${platformLabel} revision is locked for review because the provider result is uncertain. Do not resubmit it until the recorded publish attempt is reviewed.`
          : activeSchedule
            ? "This scheduled release cannot be changed in its current state."
            : `This ${platformLabel} revision cannot be scheduled in its current state.`,
      );
      return;
    }

    if (!window.confirm(exactScheduleConfirmation(action))) return;

    setMutating(true);

    try {
      const response = await fetch(
        `/api/platform-versions/${version._id}/schedule`,
        {
          method: activeSchedule ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleId: activeSchedule ? currentSchedule?._id : undefined,
            releaseSource,
            destinationLocalDateTime:
              releaseSource === "destination_override"
                ? destinationLocalDateTime
                : "",
          }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || `Unable to save the ${platformLabel} schedule.`,
        );
      }

      setScheduleState(result.scheduleState || null);
      setEditingSchedule(false);
      setMessage(activeSchedule ? "Schedule updated." : "Schedule saved.");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setMutating(false);
    }
  }

  async function cancelSchedule() {
    setMessage("");
    setError("");

    if (!scheduleState?.canCancel || !currentSchedule?._id) {
      setError("This scheduled release can no longer be cancelled.");
      return;
    }

    if (
      !window.confirm(
        `Cancel the ${wallClockLabel(currentSchedule.localDateTime)} ${currentSchedule.timezone} ${platformLabel} release for ${destinationName}?\n\nNo ${platformLabel} post will be deleted. Cancellation is only allowed before dispatch begins.`,
      )
    ) {
      return;
    }

    setMutating(true);

    try {
      const response = await fetch(
        `/api/platform-versions/${version._id}/schedule`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleId: currentSchedule._id }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || `Unable to cancel the ${platformLabel} schedule.`,
        );
      }

      setScheduleState(result.scheduleState || null);
      setEditingSchedule(false);
      setMessage(`${platformLabel} release schedule cancelled.`);
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setMutating(false);
    }
  }

  if (scheduleState?.currentRevisionPublished) {
    return (
      <details className={styles.publishHistory}>
        <summary>Schedule history</summary>
        <p>
          Published to {destinationName}. This saved version will not be
          submitted again.
        </p>
        {currentSchedule ? (
          <p>
            {wallClockLabel(currentSchedule.localDateTime)} ·{" "}
            {currentSchedule.timezone}
          </p>
        ) : null}
      </details>
    );
  }

  return (
    <div className={styles.scheduleEditor}>
      {loading ? <p className={styles.fieldHint}>Loading schedule…</p> : null}
      {currentSchedule ? (
        <div
          className={
            scheduleNeedsAttention(scheduleState?.stateCode)
              ? styles.errorNotice
              : styles.scheduleSummary
          }
        >
          <strong>
            {scheduleStateLabel(scheduleState?.stateCode)} · {destinationName}
          </strong>
          <p>
            {wallClockLabel(currentSchedule.localDateTime)} ·{" "}
            {currentSchedule.timezone}
          </p>
          {scheduleState?.stale ? (
            <p>The saved post changed. Reschedule to use the new version.</p>
          ) : null}
          {scheduleState?.stateCode === "past_release_time" ? (
            <p>This time passed. Choose a new time or cancel the schedule.</p>
          ) : null}
          {scheduleState?.stateCode === "missed_schedule" ? (
            <p>
              This post did not publish. Resolve the issue before scheduling it
              again.
            </p>
          ) : null}
          {scheduleState?.stateCode === "review_required" ? (
            <p>
              The result is uncertain. Review the recorded attempt before trying
              again.
            </p>
          ) : null}
          {currentSchedule.missedReason ? (
            <p>{currentSchedule.missedReason}</p>
          ) : null}
          {currentSchedule.failure?.message ? (
            <p>{currentSchedule.failure.message}</p>
          ) : null}
          <details className={styles.technicalDetails}>
            <summary>Schedule details</summary>
            <p>
              Revision {currentSchedule.platformVersionRevision} · UTC{" "}
              {currentSchedule.releaseAt}
            </p>
            <p>Automatic retries: {Number(currentSchedule.retryCount || 0)}</p>
          </details>
        </div>
      ) : null}
      {dirty ? (
        <div className={styles.notice}>
          Save this {platformLabel} draft before scheduling.
        </div>
      ) : null}
      {serverBlocking.length ? (
        <div className={styles.errorNotice}>
          <strong>Needs attention</strong>
          <ul>
            {serverBlocking.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div hidden={activeSchedule && !editingSchedule}>
        <div className={styles.scheduleSource}>
          <button
            className={styles.buttonSecondary}
            type="button"
            aria-pressed={releaseSource === "master"}
            onClick={() => changeReleaseSource("master")}
            disabled={
              loading || mutating || busy || !masterContent.defaultReleaseAt
            }
          >
            Use shared release time
          </button>
          <button
            className={styles.buttonSecondary}
            type="button"
            aria-pressed={releaseSource === "destination_override"}
            onClick={() => changeReleaseSource("destination_override")}
            disabled={loading || mutating || busy}
          >
            Set time for this account
          </button>
        </div>
        {releaseSource === "destination_override" ? (
          <label className={styles.field}>
            <span className={styles.label}>Date and time</span>
            <input
              className={styles.input}
              type="datetime-local"
              value={destinationLocalDateTime}
              onChange={(event) => {
                setDestinationLocalDateTime(event.target.value);
                setMessage("");
                setError("");
              }}
              disabled={loading || mutating || busy}
            />
          </label>
        ) : (
          <p className={styles.scheduleSummary}>
            {scheduleState?.masterDefault?.available
              ? wallClockLabel(scheduleState.masterDefault.localDateTime)
              : "No shared release time saved."}
          </p>
        )}
        <p className={styles.fieldHint}>
          {clientTimezone || "Client timezone unavailable"}
        </p>
        {resolvedChoice.ok ? (
          <p className={styles.releaseSummary}>
            <strong>{destinationName}</strong> ·{" "}
            {wallClockLabel(resolvedChoice.localDateTime)} ·{" "}
            {resolvedChoice.timezone}
          </p>
        ) : null}
        {choiceError &&
        (releaseSource === "master" || destinationLocalDateTime) ? (
          <div className={styles.errorNotice}>{choiceError}</div>
        ) : null}
      </div>
      {error ? (
        <div className={styles.errorNotice} role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className={styles.successNotice} role="status">
          {message}
        </div>
      ) : null}
      <div className={styles.formActions}>
        {activeSchedule ? (
          <button
            className={styles.buttonSecondary}
            type="button"
            onClick={cancelSchedule}
            disabled={loading || mutating || busy || !scheduleState?.canCancel}
          >
            Cancel schedule
          </button>
        ) : null}
        <button
          className={styles.button}
          type="button"
          onClick={() =>
            activeSchedule && !editingSchedule
              ? setEditingSchedule(true)
              : saveSchedule()
          }
          disabled={
            loading ||
            mutating ||
            busy ||
            !canSubmit ||
            ((!activeSchedule || editingSchedule) && schedulingBlocked)
          }
        >
          {mutating
            ? "Saving schedule…"
            : activeSchedule
              ? editingSchedule
                ? "Review reschedule →"
                : "Change schedule"
              : "Review schedule →"}
        </button>
      </div>
    </div>
  );
}
