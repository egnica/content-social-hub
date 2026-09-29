import assert from "node:assert/strict";
import test from "node:test";
import { validateContentInput } from "../lib/validation.js";

test("Master Content accepts an independent default video thumbnail reference", () => {
  const { data, errors } = validateContentInput({
    internalTitle: "Video post",
    clientId: "client-1",
    text: "",
    primaryUrl: "",
    contentLength: "short",
    reusable: false,
    mediaIds: ["video-1"],
    defaultPrimaryMediaId: "video-1",
    defaultVideoThumbnailMediaId: "thumb-1",
    defaultReleaseAt: "",
  });

  assert.deepEqual(errors, {});
  assert.equal(data.defaultVideoThumbnailMediaId, "thumb-1");
  assert.deepEqual(data.mediaIds, ["video-1"]);
});

test("Master Content still requires primary media to be attached publish media", () => {
  const { errors } = validateContentInput({
    internalTitle: "Video post",
    clientId: "client-1",
    mediaIds: ["video-1"],
    defaultPrimaryMediaId: "thumb-1",
    defaultVideoThumbnailMediaId: "thumb-1",
  });

  assert.match(errors.defaultPrimaryMediaId, /attached/);
});
