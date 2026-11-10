import "server-only";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import { refreshSocialConnectionHealth } from "@/lib/connections";
import { decryptSecret } from "@/lib/secure-values";
import { googleBusinessParent, validateGoogleBusinessPublish } from "@/lib/google-business-publish-logic";
import { checkGoogleBusinessPostsAccess, createGoogleBusinessPost, getGoogleBusinessPost } from "@/lib/google-business-publisher";

export class GoogleBusinessPublishConflictError extends Error {
  constructor(message, attempt = null) {
    super(message); this.name = "GoogleBusinessPublishConflictError"; this.attempt = attempt;
  }
}
export class GoogleBusinessPublishProviderError extends Error {
  constructor(message, attempt = null) {
    super(message); this.name = "GoogleBusinessPublishProviderError"; this.attempt = attempt;
  }
}
const sameId = (a, b) => Boolean(a && b && String(a) === String(b));
async function context(id) {
  const objectId = toObjectId(id);
  if (!objectId) throw new TypeError("Google version not found.");
  const db = await getDb();
  const versions = db.collection("platform_versions");
  const attempts = db.collection("publish_attempts");
  const version = await versions.findOne({ _id: objectId, platform: "google_business_profile", active: { $ne: false } });
  if (!version) throw new TypeError("Google version is unavailable.");
  const [master, connection] = await Promise.all([
    db.collection("master_content").findOne({ _id: version.masterContentId }),
    db.collection("social_connections").findOne({ _id: version.socialConnectionId }),
  ]);
  if (!master || !connection || !sameId(master.clientId, version.clientId) ||
      !sameId(connection.clientId, version.clientId) || connection.platform !== "google_business_profile" ||
      connection.providerAccountId !== version.providerAccountId) throw new TypeError("Google destination no longer belongs to this client.");
  const parent = googleBusinessParent(connection);
  const savedParent = version.googleBusinessParent ||
    (/^accounts\//.test(version.providerAccountId) ? version.providerAccountId : "");
  if (parent !== savedParent) throw new TypeError("The Google account/location changed. Save the draft against the correct location before publishing.");
  return { db, version, master, connection, parent, versions, attempts };
}
async function refreshedContext(id) {
  const before = await context(id);
  await refreshSocialConnectionHealth(String(before.connection._id));
  const current = await context(id);
  if (current.parent !== before.parent || !sameId(current.connection._id, before.connection._id)) {
    throw new TypeError("Google connection changed during validation.");
  }
  if (!["healthy", "expiring_soon"].includes(current.connection.healthStatus) ||
      current.connection.capabilities?.canManageLocation !== true) throw new TypeError("Check Google location health or reconnect before publishing.");
  return current;
}
function view(version, attempt) {
  return serializeDocument({ platformVersion: version, attempt });
}
async function recordResult(c, attempt, result) {
  const now = new Date();
  // Persist the provider identity first. Failure after acceptance must never unlock
  // or retry create; a recorded identity can be reconciled by read-only refresh.
  const prior = await c.attempts.findOne({ _id: attempt._id });
  if (!prior) throw new GoogleBusinessPublishConflictError("The Google attempt is unavailable. Do not repost.");
  const terminal = ["succeeded", "rejected"].includes(prior.status);
  if (terminal && prior.status !== result.status) result = prior;
  const savedAttempt = await c.attempts.findOneAndUpdate({ _id: attempt._id, status: prior.status }, { $set: {
    providerPostId: result.providerPostId, providerPostUrl: result.providerPostUrl,
    providerState: result.providerState, status: result.status, updatedAt: now,
    completedAt: prior.completedAt || (["succeeded", "rejected"].includes(result.status) ? now : null),
    providerError: result.status === "rejected" ? { message: "Google rejected this post. Create a new draft after reviewing its content policy." } : null,
  } }, { returnDocument: "after" }) || await c.attempts.findOne({ _id: attempt._id });
  if (!savedAttempt) throw new GoogleBusinessPublishConflictError("The Google result could not be recorded. Do not repost.");
  result = savedAttempt;
  const saved = await c.versions.findOneAndUpdate({
    _id: c.version._id, revision: attempt.platformVersionRevision,
    lastPublishAttemptId: attempt._id, googlePublishLock: true,
  }, { $set: {
    providerPostId: result.providerPostId, providerPostUrl: result.providerPostUrl,
    googleProviderState: result.providerState, lastPublishStatus: result.status,
    status: result.status === "succeeded" ? "published" : result.status === "rejected" ? "failed" : "publishing",
    lastPublishError: savedAttempt?.providerError || null, updatedAt: now,
    ...(result.status === "succeeded" ? { publishedAt: savedAttempt.completedAt || now, publishedRevision: attempt.platformVersionRevision } : {}),
  } }, { returnDocument: "after" });
  if (!saved) throw new GoogleBusinessPublishConflictError("Google accepted this post, but the saved version changed. Do not repost.", serializeDocument(savedAttempt));
  return view(saved, savedAttempt);
}

export async function publishGoogleBusinessVersion(id, expectedRevision) {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new TypeError("Confirm the saved Google revision before publishing.");
  let c = await context(id);
  if (Number(c.version.revision) !== expectedRevision) throw new GoogleBusinessPublishConflictError("The Google draft changed. Reload and confirm its current revision.");
  if (c.version.googlePublishLock || c.version.publishedRevision) {
    const prior = c.version.lastPublishAttemptId ? await c.attempts.findOne({ _id: c.version.lastPublishAttemptId }) : null;
    throw new GoogleBusinessPublishConflictError("This Google destination has a recorded submission. Review its result; do not repost.", serializeDocument(prior));
  }
  c = await refreshedContext(id);
  const validation = validateGoogleBusinessPublish(c.version, c.master);
  if (!validation.publishable) throw new TypeError(validation.blocking.join(" "));
  const credential = c.connection.tokenEncrypted;
  const accessToken = decryptSecret(credential);
  try { await checkGoogleBusinessPostsAccess({ accessToken, parent: c.parent }); }
  catch (error) { throw new GoogleBusinessPublishProviderError(error?.name === "GoogleBusinessPublishApiError" ? error.message : "Google Local Posts access could not be verified. No post was submitted."); }
  await c.attempts.createIndex({ submissionKey: 1 }, { unique: true, sparse: true });
  const now = new Date();
  const claimed = await c.versions.findOneAndUpdate({
    _id: c.version._id, platform: "google_business_profile", clientId: c.version.clientId,
    revision: expectedRevision, active: { $ne: false }, googlePublishLock: { $ne: true },
    publishedRevision: { $ne: expectedRevision },
  }, { $set: { googlePublishLock: true, lastPublishStatus: "submitting", updatedAt: now } }, { returnDocument: "after" });
  if (!claimed) throw new GoogleBusinessPublishConflictError("The Google version changed or is already submitting. Reload before continuing.");
  let attempt;
  try {
    const record = {
      submissionKey: `google:${id}:${expectedRevision}`, platform: "google_business_profile", publishMode: "standard_text",
      platformVersionId: c.version._id, masterContentId: c.version.masterContentId,
      clientId: c.version.clientId, socialConnectionId: c.version.socialConnectionId,
      platformVersionRevision: expectedRevision, masterRevision: c.master.revision,
      providerParent: c.parent, submittedContent: { summary: c.version.summary, ctaType: c.version.ctaType, ctaUrl: c.version.ctaUrl },
      trigger: "manual", triggeredBy: "owner", status: "submitting", providerPostId: "", providerPostUrl: "",
      providerError: null, createdAt: now, startedAt: now, updatedAt: now,
    };
    const inserted = await c.attempts.insertOne(record);
    attempt = { ...record, _id: inserted.insertedId };
    const attached = await c.versions.updateOne({ _id: c.version._id, revision: expectedRevision, googlePublishLock: true },
      { $set: { lastPublishAttemptId: attempt._id } });
    if (!attached.matchedCount) throw new Error("Claim changed");
  } catch {
    // No remote request occurred, but uncertain database state needs review.
    throw new GoogleBusinessPublishConflictError("The Google submission record could not be confirmed. Publishing is locked for review.");
  }
  let createStarted = false;
  let result;
  try {
    const current = await context(id);
    if (Number(current.version.revision) !== expectedRevision || current.parent !== c.parent ||
        current.connection.tokenEncrypted !== credential || Number(current.master.revision) !== Number(c.master.revision)) {
      throw new TypeError("The Google content or connection changed before submission. Reload before retrying.");
    }
    createStarted = true;
    result = await createGoogleBusinessPost({ accessToken, parent: c.parent, version: c.version });
  } catch (error) {
    const definitive = !createStarted || (error?.name === "GoogleBusinessPublishApiError" &&
      [400, 401, 403, 404, 405, 413, 422].includes(error.status));
    const status = definitive ? "failed" : "unknown";
    const providerError = { message: !createStarted ? "The content or connection changed before submission. Reload and review before retrying." :
      error?.name === "GoogleBusinessPublishApiError" ? error.message : "Google may have accepted this post. Review the result before publishing again.",
      status: Number.isInteger(error?.status) ? error.status : null, isTransient: false };
    await c.attempts.updateOne({ _id: attempt._id }, {
      $set: { status, providerError, completedAt: new Date(), updatedAt: new Date() },
      ...(definitive ? { $unset: { submissionKey: "" } } : {}),
    });
    await c.versions.updateOne({ _id: c.version._id, lastPublishAttemptId: attempt._id }, { $set: {
      googlePublishLock: !definitive, lastPublishStatus: status, lastPublishError: providerError, updatedAt: new Date(),
    } });
    throw new GoogleBusinessPublishProviderError(providerError.message, serializeDocument(await c.attempts.findOne({ _id: attempt._id })));
  }
  return recordResult(c, attempt, result);
}

export async function refreshGoogleBusinessPostStatus(id) {
  const c = await refreshedContext(id);
  const attempt = c.version.lastPublishAttemptId ? await c.attempts.findOne({
    _id: c.version.lastPublishAttemptId, platform: "google_business_profile", platformVersionId: c.version._id,
    clientId: c.version.clientId, socialConnectionId: c.version.socialConnectionId,
    platformVersionRevision: c.version.revision, providerParent: c.parent,
  }) : null;
  if (!attempt?.providerPostId) throw new GoogleBusinessPublishConflictError("No verified Google post identity is recorded. Review the destination on Google before taking further action.", serializeDocument(attempt));
  if (["succeeded", "rejected"].includes(attempt.status) && c.version.lastPublishStatus === attempt.status &&
      (attempt.status === "rejected" || attempt.providerPostUrl)) return view(c.version, attempt);
  let result;
  try { result = await getGoogleBusinessPost({ accessToken: decryptSecret(c.connection.tokenEncrypted), parent: c.parent, name: attempt.providerPostId }); }
  catch { throw new GoogleBusinessPublishProviderError("Google post status could not be verified. The existing submission remains locked; do not repost.", serializeDocument(attempt)); }
  return recordResult(c, attempt, result);
}
