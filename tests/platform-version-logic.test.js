import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInheritedFacebookFields,
  isFacebookVersionOutOfSync,
  isPublishableFacebookConnection,
  normalizeFacebookVersionDraft,
  planPlatformVersionSelection,
  uniqueStringIds,
  validateFacebookVersionDraft,
} from "../lib/platform-version-logic.js";

test("uniqueStringIds removes duplicate and blank selections", () => {
  assert.deepEqual(uniqueStringIds(["a", "a", " b ", "", null]), ["a", "b"]);
});

test("Facebook destination eligibility requires same client, healthy state, and publish capability", () => {
  const connection = {
    clientId: "client-a",
    platform: "facebook",
    healthStatus: "healthy",
    capabilities: { canPublish: true },
  };

  assert.equal(isPublishableFacebookConnection(connection, "client-a"), true);
  assert.equal(isPublishableFacebookConnection(connection, "client-b"), false);
  assert.equal(
    isPublishableFacebookConnection({ ...connection, healthStatus: "expired" }, "client-a"),
    false,
  );
  assert.equal(
    isPublishableFacebookConnection(
      { ...connection, capabilities: { canPublish: false } },
      "client-a",
    ),
    false,
  );
});

test("new Facebook versions inherit Master defaults, video thumbnail, and revision marker", () => {
  assert.deepEqual(
    buildInheritedFacebookFields({
      text: "Master copy",
      primaryUrl: "https://example.com/page",
      mediaIds: ["media-1", "media-2"],
      defaultPrimaryMediaId: "media-2",
      defaultVideoThumbnailMediaId: "thumb-1",
      revision: 4,
    }),
    {
      message: "Master copy",
      destinationUrl: "https://example.com/page",
      mediaIds: ["media-1", "media-2"],
      primaryMediaId: "media-2",
      videoThumbnailMediaId: "thumb-1",
      masterRevisionSynced: 4,
      customized: false,
    },
  );
});

test("selection plan prevents duplicate creates and excludes removed destinations", () => {
  const plan = planPlatformVersionSelection({
    existingVersions: [
      { socialConnectionId: "keep", active: true },
      { socialConnectionId: "reactivate", active: false },
      { socialConnectionId: "remove", active: true },
    ],
    selectedConnectionIds: ["keep", "reactivate", "new", "new"],
  });

  assert.deepEqual(plan, {
    create: ["new"],
    reactivate: ["reactivate"],
    keep: ["keep"],
    exclude: ["remove"],
  });
});

test("Facebook version detects a changed Master revision", () => {
  assert.equal(
    isFacebookVersionOutOfSync({ masterRevisionSynced: 2 }, 3),
    true,
  );
  assert.equal(
    isFacebookVersionOutOfSync({ masterRevisionSynced: 3 }, 3),
    false,
  );
});

test("Facebook live validation blocks unhealthy and empty drafts", () => {
  const result = validateFacebookVersionDraft({
    message: "",
    destinationUrl: "",
    mediaIds: [],
    healthStatus: "expired",
    canPublish: false,
  });

  assert.equal(result.publishable, false);
  assert.equal(result.blocking.length, 2);
});

test("Facebook live validation warns on stale customized content without overwriting it", () => {
  const result = validateFacebookVersionDraft({
    message: "Custom Facebook copy",
    healthStatus: "healthy",
    canPublish: true,
    masterChanged: true,
    customized: true,
  });

  assert.equal(result.publishable, true);
  assert.equal(result.blocking.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /edits are preserved/);
});

test("Facebook draft normalization keeps attached media and independent thumbnail override", () => {
  assert.deepEqual(
    normalizeFacebookVersionDraft(
      {
        message: "Facebook copy",
        destinationUrl: "https://example.com",
        mediaIds: ["media-2", "foreign", "media-1"],
        primaryMediaId: "foreign",
        videoThumbnailMediaId: "thumb-1",
      },
      ["media-1", "media-2"],
    ),
    {
      message: "Facebook copy",
      destinationUrl: "https://example.com",
      mediaIds: ["media-2", "media-1"],
      primaryMediaId: "media-2",
      videoThumbnailMediaId: "thumb-1",
    },
  );
});

test("Facebook defaults to a native link card instead of automatically attaching an Open Graph image", () => {
  const og = { _id: "og-1", sourceType: "open_graph", contentType: "image/jpeg" };
  const inherited = buildInheritedFacebookFields({
    text: "Article", primaryUrl: "https://example.com", mediaIds: ["og-1"],
    defaultPrimaryMediaId: "og-1", media: [og], revision: 2,
  });
  assert.deepEqual(inherited.mediaIds, []);
  assert.equal(inherited.primaryMediaId, "");
  assert.equal(inherited.destinationUrl, "https://example.com");
  // The user can still explicitly attach this client-owned imported image.
  assert.deepEqual(normalizeFacebookVersionDraft({
    destinationUrl: inherited.destinationUrl, mediaIds: ["og-1"],
    primaryMediaId: "og-1" }, ["og-1"]).mediaIds, ["og-1"]);
});

test("Facebook retains manual media when a link and automatic image coexist", () => {
  const inherited = buildInheritedFacebookFields({
    primaryUrl: "https://example.com", mediaIds: ["og-1", "manual-1"],
    defaultPrimaryMediaId: "og-1",
    media: [{ _id: "og-1", sourceType: "open_graph" }, { _id: "manual-1", contentType: "video/mp4" }],
  });
  assert.deepEqual(inherited.mediaIds, ["manual-1"]);
  assert.equal(inherited.primaryMediaId, "manual-1");
});
