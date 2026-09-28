import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInheritedFacebookFields,
  isPublishableFacebookConnection,
  planPlatformVersionSelection,
  uniqueStringIds,
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

test("new Facebook versions inherit Master defaults and revision marker", () => {
  assert.deepEqual(
    buildInheritedFacebookFields({
      text: "Master copy",
      primaryUrl: "https://example.com/page",
      mediaIds: ["media-1", "media-2"],
      defaultPrimaryMediaId: "media-2",
      revision: 4,
    }),
    {
      message: "Master copy",
      destinationUrl: "https://example.com/page",
      mediaIds: ["media-1", "media-2"],
      primaryMediaId: "media-2",
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
