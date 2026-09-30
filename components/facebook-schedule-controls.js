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

function releaseChoiceError(resolved, version) {
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
    already_published_revision:
      "This Facebook revision has already been published and cannot be scheduled again.",
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

export default function FacebookScheduleControls({
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
  const [releaseSource, setReleaseSource] = useState("master");
  const [destinationLocalDateTime, setDestinationLocalDateTime] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const destinationName =
    version.destinationName || destination?.accountName || "Facebook Page";
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
          throw new Error(result.error || "Unable to load the Facebook schedule.");
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
  const choiceError = releaseChoiceError(resolvedChoice, version);
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
      `${verb} this exact Facebook revision for ${destinationName}?`,
      "",
      `Revision: ${version.revision || 1}`,
      `Release: ${wallClockLabel(resolvedChoice.localDateTime)}`,
      `Timezone: ${resolvedChoice.timezone}`,
      `UTC: ${resolvedChoice.releaseAtIso}`,
      `Source: ${releaseSource === "master" ? "Master default" : "Destination override"}`,
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
      "This saves the durable schedule in Content Social Hub and creates or updates its AWS timed trigger. At release time the background worker will revalidate the exact saved revision before publishing.",
    );

    return lines.join("\n");
  }

  async function saveSchedule() {
    setMessage("");
    setError("");

    if (dirty) {
      setError("Save the Facebook version before scheduling it.");
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
          ? "This Facebook revision is locked for review because the provider result is uncertain. Do not resubmit it until the recorded publish attempt is reviewed."
          : activeSchedule
            ? "This scheduled release cannot be changed in its current state."
            : "This Facebook revision cannot be scheduled in its current state.",
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
        throw new Error(result.error || "Unable to save the Facebook schedule.");
      }

      setScheduleState(result.scheduleState || null);
      setMessage(
        activeSchedule
          ? `Facebook release rescheduled for ${wallClockLabel(result.schedule?.localDateTime)} ${result.schedule?.timezone || ""}.`
          : `Facebook release scheduled for ${wallClockLabel(result.schedule?.localDateTime)} ${result.schedule?.timezone || ""}.`,
      );
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
        `Cancel the ${wallClockLabel(currentSchedule.localDateTime)} ${currentSchedule.timezone} Facebook release for ${destinationName}?\n\nNo Facebook post will be deleted. Cancellation is only allowed before dispatch begins.`,
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
        throw new Error(result.error || "Unable to cancel the Facebook schedule.");
      }

      setScheduleState(result.scheduleState || null);
      setMessage("Facebook release schedule cancelled.");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setMutating(false);
    }
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div className={styles.sectionHeader}>
        <h2>Schedule</h2>
        <p>
          Save a destination-level release time for this exact Facebook revision.
          The client timezone is authoritative; AWS wakes the background worker at
          the resolved UTC instant.
        </p>
      </div>

      <div className={styles.notice}>
        <strong>Client timezone:</strong> {clientTimezone || "Unavailable"}
      </div>

      {loading ? <div className={styles.notice}>Loading schedule state…</div> : null}

      {currentSchedule ? (
        <div
          className={
            scheduleNeedsAttention(scheduleState?.stateCode)
              ? styles.errorNotice
              : scheduleState?.stateCode === "succeeded" || currentSchedule.active
                ? styles.successNotice
                : styles.notice
          }
        >
          <strong>{scheduleStateLabel(scheduleState?.stateCode)}</strong>
          <div style={{ marginTop: 6 }}>
            Revision {currentSchedule.platformVersionRevision} ·{" "}
            {wallClockLabel(currentSchedule.localDateTime)} ·{" "}
            {currentSchedule.timezone}
          </div>
          <div style={{ marginTop: 4, fontSize: 12 }}>
            {currentSchedule.releaseSource === "destination_override"
              ? "Destination override"
              : "Master default"}{" "}
            · UTC {currentSchedule.releaseAt}
          </div>
          {Number(currentSchedule.retryCount || 0) > 0 ? (
            <div style={{ marginTop: 4, fontSize: 12 }}>
              Automatic technical retries used: {currentSchedule.retryCount}
            </div>
          ) : null}
          {scheduleState?.stale ? (
            <div style={{ marginTop: 7 }}>
              The Facebook content is now revision {version.revision}. This older
              schedule will not be allowed to release the edited content. Reschedule
              deliberately to bind the current revision.
            </div>
          ) : null}
          {scheduleState?.stateCode === "past_release_time" ? (
            <div style={{ marginTop: 7 }}>
              This release time has passed. Reschedule or cancel it; Content Social
              Hub does not publish late automatically.
            </div>
          ) : null}
          {scheduleState?.stateCode === "missed_schedule" ? (
            <div style={{ marginTop: 7 }}>
              The scheduled release was blocked at publish time and was not posted.
              Fix the issue, then deliberately schedule the current revision again.
            </div>
          ) : null}
          {scheduleState?.stateCode === "failed" ? (
            <div style={{ marginTop: 7 }}>
              Facebook returned a definitive failure. The schedule stopped instead of
              posting late. After fixing the issue, this revision can be deliberately
              scheduled again under the existing duplicate-safety rules.
            </div>
          ) : null}
          {scheduleState?.stateCode === "review_required" ? (
            <div style={{ marginTop: 7 }}>
              Facebook may have received this publish request, but the final result is
              uncertain. Automatic retry is locked to prevent a duplicate post. Review
              the recorded publish attempt before taking further action.
            </div>
          ) : null}
          {currentSchedule.missedReason ? (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Reason: {currentSchedule.missedReason}
            </div>
          ) : null}
          {currentSchedule.failure?.message ? (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Last error: {currentSchedule.failure.message}
            </div>
          ) : null}
        </div>
      ) : null}

      {scheduleState?.currentRevisionPublished ? (
        <div className={styles.errorNotice}>
          This Facebook revision has already been published and cannot be scheduled
          again.
        </div>
      ) : null}

      {dirty ? (
        <div className={styles.notice}>
          Save the Facebook version before scheduling so the schedule binds the exact
          saved revision.
        </div>
      ) : null}

      {serverBlocking.length ? (
        <div className={styles.errorNotice}>
          <strong>Scheduling blocked</strong>
          <ul style={{ margin: "7px 0 0 18px" }}>
            {serverBlocking.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className={styles.fieldGrid} style={{ marginTop: 16 }}>
        <label className={styles.fieldFull}>
          <span className={styles.label}>Release time source</span>
          <select
            className={styles.select}
            value={releaseSource}
            onChange={(event) => changeReleaseSource(event.target.value)}
            disabled={loading || mutating || busy}
          >
            <option value="master">Use Master default release time</option>
            <option value="destination_override">
              Use a Facebook-specific release time
            </option>
          </select>
        </label>

        {releaseSource === "destination_override" ? (
          <label className={styles.fieldFull}>
            <span className={styles.label}>
              Facebook release date and time ({clientTimezone || "client timezone"})
            </span>
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
          <div className={styles.fieldFull}>
            <span className={styles.label}>Master default</span>
            <div className={styles.notice} style={{ margin: 0 }}>
              {scheduleState?.masterDefault?.available
                ? `${wallClockLabel(scheduleState.masterDefault.localDateTime)} · ${scheduleState.masterDefault.timezone}`
                : scheduleState?.masterDefault?.error ||
                  "No Master default release time is saved."}
            </div>
          </div>
        )}
      </div>

      {resolvedChoice.ok ? (
        <div className={styles.notice} style={{ marginTop: 14 }}>
          <strong>Resolved release:</strong>{" "}
          {wallClockLabel(resolvedChoice.localDateTime)} · {resolvedChoice.timezone}
          <div style={{ marginTop: 4, fontSize: 12 }}>
            UTC {resolvedChoice.releaseAtIso}
          </div>
        </div>
      ) : null}

      {choiceError ? <div className={styles.errorNotice}>{choiceError}</div> : null}
      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {message ? <div className={styles.successNotice}>{message}</div> : null}

      <div className={styles.formActions}>
        <button
          className={styles.button}
          type="button"
          onClick={saveSchedule}
          disabled={
            loading ||
            mutating ||
            busy ||
            schedulingBlocked ||
            !canSubmit
          }
        >
          {mutating
            ? "Saving Schedule…"
            : activeSchedule
              ? "Reschedule"
              : "Schedule"}
        </button>

        {activeSchedule ? (
          <button
            className={styles.buttonSecondary}
            type="button"
            onClick={cancelSchedule}
            disabled={loading || mutating || busy || !scheduleState?.canCancel}
          >
            Cancel Schedule
          </button>
        ) : null}
      </div>
    </div>
  );
}
