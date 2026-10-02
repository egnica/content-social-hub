import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInheritedInstagramFields,
  instagramMediaMode,
  isInstagramVersionOutOfSync,
  isPublishableInstagramConnection,
  normalizeInstagramVersionDraft,
  validateInstagramVersionDraft,
} from "../lib/platform-version-logic.js";

const media = [
  { _id: "image-1", contentType: "image/jpeg" },
  { _id: "image-2", contentType: "image/png" },
  { _id: "video-1", contentType: "video/mp4" },
  { _id: "other-1", contentType: "application/pdf" },
];

test("Instagram destination eligibility requires same client, platform, healthy state, and publish capability", () => {
  const connection = {
    clientId: "client-a",
    platform: "instagram",
    healthStatus: "healthy",
    capabilities: { canPublish: true },
  };

  assert.equal(isPublishableInstagramConnection(connection, "client-a"), true);
  assert.equal(isPublishableInstagramConnection(connection, "client-b"), false);
  assert.equal(
    isPublishableInstagramConnection(
      { ...connection, platform: "facebook" },
      "client-a",
    ),
    false,
  );
  assert.equal(
    isPublishableInstagramConnection(
      { ...connection, healthStatus: "permission_problem" },
      "client-a",
    ),
    false,
  );
  assert.equal(
    isPublishableInstagramConnection(
      { ...connection, capabilities: { canPublish: false } },
      "client-a",
    ),
    false,
  );
});

test("new Instagram versions inherit Master caption, media, primary media, and revision marker", () => {
  assert.deepEqual(
    buildInheritedInstagramFields({
      text: "Master caption",
      mediaIds: ["image-1", "image-2"],
      defaultPrimaryMediaId: "image-2",
      defaultVideoThumbnailMediaId: "thumb-1",
      revision: 7,
    }),
    {
      caption: "Master caption",
      mediaIds: ["image-1", "image-2"],
      primaryMediaId: "image-2",
      videoThumbnailMediaId: "thumb-1",
      masterRevisionSynced: 7,
      customized: false,
    },
  );
});

test("Instagram media mode distinguishes single image, carousel, Reel/video, and incompatible selections", () => {
  assert.equal(instagramMediaMode(media, ["image-1"]), "single_image");
  assert.equal(
    instagramMediaMode(media, ["image-1", "video-1"]),
    "carousel",
  );
  assert.equal(instagramMediaMode(media, ["video-1"]), "reel");
  assert.equal(instagramMediaMode(media, ["other-1"]), "incompatible");
  assert.equal(instagramMediaMode(media, []), "incompatible");
});

test("Instagram validation blocks text-only and URL-only style content without media", () => {
  const result = validateInstagramVersionDraft({
    caption: "Caption without media",
    mediaIds: [],
    media,
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(result.publishable, false);
  assert.equal(result.mediaMode, "incompatible");
  assert.match(result.blocking[0], /requires at least one compatible image or video/);
});

test("Instagram validation accepts healthy compatible media and reports the detected format", () => {
  const result = validateInstagramVersionDraft({
    caption: "Instagram caption",
    mediaIds: ["image-1", "image-2"],
    media,
    healthStatus: "healthy",
    canPublish: true,
  });

  assert.equal(result.publishable, true);
  assert.equal(result.mediaMode, "carousel");
  assert.deepEqual(result.blocking, []);
});

test("Instagram validation blocks unhealthy destinations and unsupported media", () => {
  const result = validateInstagramVersionDraft({
    mediaIds: ["other-1"],
    media,
    healthStatus: "expired",
    canPublish: false,
  });

  assert.equal(result.publishable, false);
  assert.equal(result.blocking.length, 2);
});

test("Instagram customized versions preserve edits when Master changes", () => {
  assert.equal(
    isInstagramVersionOutOfSync({ masterRevisionSynced: 2 }, 3),
    true,
  );

  const result = validateInstagramVersionDraft({
    caption: "Custom caption",
    mediaIds: ["image-1"],
    media,
    healthStatus: "healthy",
    canPublish: true,
    masterChanged: true,
    customized: true,
  });

  assert.equal(result.publishable, true);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /edits are preserved/);
});

test("Instagram draft normalization keeps only Master-attached media and a valid primary choice", () => {
  assert.deepEqual(
    normalizeInstagramVersionDraft(
      {
        caption: "Custom caption",
        mediaIds: ["image-2", "foreign", "image-1"],
        primaryMediaId: "foreign",
      },
      ["image-1", "image-2"],
    ),
    {
      caption: "Custom caption",
      mediaIds: ["image-2", "image-1"],
      primaryMediaId: "image-2",
    },
  );
});
