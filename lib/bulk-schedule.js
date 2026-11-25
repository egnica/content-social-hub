import "server-only";
import { getImportedBulkContent } from "@/lib/data";
import { bulkDraftFingerprint, validateBulkDraftAccounts } from "@/lib/bulk-draft-logic";
import { getPlatformDestinationState } from "@/lib/platform-versions";
import { getDestinationScheduleState } from "@/lib/scheduling";
import { createDestinationScheduleWithInfrastructure } from "@/lib/schedule-infrastructure";
import { classifyBulkSchedule, reviewKey } from "@/lib/bulk-schedule-logic";

export async function reviewBulkScheduleRow(post, client, connections) {
  const base = { row: post.row, post_key: post.post_key, title: post.title, releaseAt: post.releaseAt };
  const blocked = (error) => ({ ...base, destinations: post.destinations.map(({ account }) => ({ account, status: "blocked", error })) });
  const fingerprint = bulkDraftFingerprint(client._id, post);
  try {
    validateBulkDraftAccounts(post, connections, client._id);
    const master = await getImportedBulkContent(client._id, post.post_key);
    if (!master || master.clientId !== client._id || master.bulkImport?.fingerprint !== fingerprint) {
      return blocked("Create or verify this exact imported draft first.");
    }
    const selection = await getPlatformDestinationState(master._id);
    const versions = selection?.platformVersions || [];
    const destinations = [];
    for (const { account } of post.destinations) {
      const matching = versions.filter(v => v.active !== false && v.clientId === client._id &&
        v.masterContentId === master._id && v.socialConnectionId === account.id && v.platform === account.platform);
      if (matching.length !== 1) {
        destinations.push({ account, status: "blocked", error: "The selected destination draft is missing or excluded." });
        continue;
      }
      const version = matching[0];
      try {
        const state = await getDestinationScheduleState(version._id);
        const classification = classifyBulkSchedule(state, post.releaseAt, client.timezone);
        const versionRevision = Number(version.revision || 1);
        const masterRevision = Number(master.revision || 1);
        const key = reviewKey({ clientId: client._id, masterId: master._id, masterRevision,
          versionId: version._id, versionRevision, accountId: account.id, releaseAt: post.releaseAt, fingerprint });
        if (state.platformVersionRevision !== versionRevision) {
          destinations.push({ account, status: "blocked", error: "The draft changed during review. Review again." });
          continue;
        }
        if (account.platform === "linkedin" && !state.tokenExpiresAt && classification.status === "ready") {
          classification.status = "blocked";
          classification.error = "LinkedIn authorization expiry is unavailable. Check access first.";
        }
        destinations.push({ account, ...classification, key, versionId: version._id, versionRevision,
          masterRevision, text: version.message || version.caption || version.summary || version.description || "",
          link: version.destinationUrl || version.ctaUrl || "", warnings: state.validation?.warnings || [] });
      } catch (error) {
        destinations.push({ account, status: "blocked", error: error instanceof TypeError ? error.message : "Unable to verify this destination." });
      }
    }
    return { ...base, contentId: master._id, destinations };
  } catch (error) {
    return blocked(error instanceof TypeError ? error.message : "Unable to verify the imported draft.");
  }
}

export async function scheduleBulkRow(post, client, connections, approvedKeys) {
  const reviewed = await reviewBulkScheduleRow(post, client, connections);
  const destinations = [];
  for (const destination of reviewed.destinations) {
    if (!approvedKeys.has(destination.key)) {
      destinations.push({ ...destination, status: "skipped", error: destination.error || "Not included in the confirmed review, or the draft changed. Review again." });
      continue;
    }
    if (destination.status !== "ready") {
      destinations.push(destination);
      continue;
    }
    try {
      const schedule = await createDestinationScheduleWithInfrastructure({
        platformVersionId: destination.versionId, releaseSource: "master",
        expectedBulk: { clientId: client._id, masterId: reviewed.contentId,
          accountId: destination.account.id, masterRevision: destination.masterRevision,
          versionRevision: destination.versionRevision, releaseAt: post.releaseAt, timezone: client.timezone },
      });
      destinations.push({ ...destination, status: "scheduled", scheduleId: schedule._id });
    } catch (error) {
      // Do not retry an uncertain AWS result automatically. Re-review can identify a linked schedule.
      destinations.push({ ...destination, status: "blocked",
        error: error instanceof TypeError ? error.message : "Scheduling could not be confirmed. Review the destination before retrying." });
    }
  }
  return { ...reviewed, destinations };
}
