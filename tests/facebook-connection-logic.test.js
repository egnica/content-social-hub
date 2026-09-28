import test from "node:test";
import assert from "node:assert/strict";
import {
  annotateFacebookPagesWithPermissions,
  canFacebookPagePublish,
  getFacebookPagePermissions,
  getFacebookPageTargetIds,
  mergeFacebookManagedPageCapabilities,
} from "../lib/facebook-connection-logic.js";

const tokenDetails = {
  scopes: [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "public_profile",
  ],
  granularScopes: [
    { scope: "pages_show_list", targetIds: ["davis", "clean"] },
    { scope: "pages_read_engagement", targetIds: ["davis", "clean"] },
    { scope: "pages_manage_posts", targetIds: ["clean"] },
    { scope: "business_management", targetIds: ["other"] },
  ],
};

test("discovers unique Page targets only from required Page permissions", () => {
  assert.deepEqual(getFacebookPageTargetIds(tokenDetails), ["davis", "clean"]);
});

test("maps granular permissions to the specific Page target", () => {
  assert.deepEqual(getFacebookPagePermissions(tokenDetails, "davis"), [
    "pages_show_list",
    "pages_read_engagement",
  ]);
  assert.deepEqual(getFacebookPagePermissions(tokenDetails, "clean"), [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
  ]);
});

test("restores Page tasks from me/accounts when direct Page recovery omits them", () => {
  const [davis] = mergeFacebookManagedPageCapabilities(
    [{ providerAccountId: "davis", accountName: "Davis", tasks: [] }],
    [
      {
        providerAccountId: "davis",
        accountName: "Davis",
        tasks: ["CREATE_CONTENT"],
      },
    ],
  );

  assert.deepEqual(davis.tasks, ["CREATE_CONTENT"]);
});

test("preserves a real CREATE_CONTENT task even when granular manage-posts targets are incomplete", () => {
  const [davis] = annotateFacebookPagesWithPermissions(
    [
      {
        providerAccountId: "davis",
        accountName: "Davis",
        tasks: ["CREATE_CONTENT"],
      },
    ],
    tokenDetails,
  );

  assert.deepEqual(davis.tasks, ["CREATE_CONTENT"]);
  assert.equal(canFacebookPagePublish(davis.permissions), false);
});

test("does not make a Page publishable just because the user token has pages_manage_posts globally", () => {
  const [davis, clean] = annotateFacebookPagesWithPermissions(
    [
      { providerAccountId: "davis", accountName: "Davis" },
      { providerAccountId: "clean", accountName: "Let Us Clean" },
    ],
    tokenDetails,
  );

  assert.deepEqual(davis.tasks, []);
  assert.deepEqual(clean.tasks, ["CREATE_CONTENT"]);
  assert.equal(canFacebookPagePublish(davis.permissions), false);
  assert.equal(canFacebookPagePublish(clean.permissions), true);
});

test("falls back to token scopes when Meta returns no granular entry for a permission", () => {
  const details = {
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
    granularScopes: [],
  };

  assert.deepEqual(getFacebookPagePermissions(details, "123"), [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
  ]);
});
