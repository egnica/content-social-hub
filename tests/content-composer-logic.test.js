import assert from "node:assert/strict";
import test from "node:test";
import {
  composerStatus,
  freshContentSource,
  isCurrentRevisionPublished,
} from "../lib/content-composer-logic.js";

test("only the exact successfully published revision gets the published UI", () => {
  assert.equal(
    isCurrentRevisionPublished({ revision: 3, publishedRevision: 3 }),
    true,
  );
  assert.equal(
    isCurrentRevisionPublished({ revision: 4, publishedRevision: 3 }),
    false,
  );
  assert.equal(isCurrentRevisionPublished({}), false);
});

test("composer does not label pending, stale or uncertain releases as drafts", () => {
  const version = { revision: 4, publishedRevision: 3 };
  assert.equal(
    composerStatus(version, {
      schedule: { active: true },
      stateCode: "active_schedule",
    }),
    "Scheduled",
  );
  assert.equal(
    composerStatus(version, {
      schedule: { active: true },
      stateCode: "stale_content_revision",
    }),
    "Needs attention",
  );
  assert.equal(
    composerStatus(version, { stateCode: "missed_schedule" }),
    "Needs attention",
  );
  assert.equal(
    composerStatus(version, { stateCode: "review_required" }),
    "Review required",
  );
  assert.equal(
    composerStatus(version, { stateCode: "dispatching" }),
    "Publishing",
  );
  assert.equal(
    composerStatus(
      { revision: 3, publishedRevision: 3 },
      { stateCode: "succeeded" },
    ),
    "Published",
  );
});

test("new drafts carry source assets but no old identity, approval, result or release", () => {
  const source = freshContentSource({
    _id: "old-content",
    clientId: "client",
    internalTitle: "Article",
    text: "Shared copy",
    media: [{ _id: "media" }],
    revision: 3,
    publishedRevision: 3,
    status: "published",
    providerPostId: "remote",
    providerPostUrl: "https://example.com/post",
    approvals: ["approved"],
    platformVersions: ["old-version"],
    defaultReleaseAt: "2026-10-09T15:00:00Z",
    defaultReleaseTimezone: "America/Chicago",
  });
  assert.equal(source.clientId, "client");
  assert.deepEqual(source.media, [{ _id: "media" }]);
  assert.equal(source.defaultReleaseAt, null);
  assert.equal(source.defaultReleaseTimezone, null);
  for (const field of [
    "_id",
    "revision",
    "publishedRevision",
    "status",
    "providerPostId",
    "providerPostUrl",
    "approvals",
    "platformVersions",
  ])
    assert.equal(Object.hasOwn(source, field), false);
});
