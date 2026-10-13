import assert from "node:assert/strict";
import test from "node:test";
import {
  validateLinkedInScheduledPublishDraft,
} from "../lib/linkedin-publish-logic.js";
import {
  buildAwsScheduleName,
  buildScheduledReleasePayload,
} from "../lib/aws-scheduler-logic.js";

const base = {
  message: "A real LinkedIn post",
  healthStatus: "healthy",
  canPublish: true,
  mediaIds: [],
  mediaAssets: [],
};

test("LinkedIn schedules only proven text and link modes", () => {
  assert.equal(validateLinkedInScheduledPublishDraft(base).publishable, true);
  const link = validateLinkedInScheduledPublishDraft({
    ...base,
    destinationUrl: "https://example.com",
  });
  assert.equal(link.publishMode, "link");
  assert.equal(link.publishable, true);
});

test("LinkedIn one-image schedules retain media validation", () => {
  const image = {
    ...base,
    mediaIds: ["asset-1"],
    mediaAssets: [{ _id: "asset-1", contentType: "image/png", size: 1024 }],
  };
  assert.equal(validateLinkedInScheduledPublishDraft(image).publishMode, "image");
  assert.equal(validateLinkedInScheduledPublishDraft(image).publishable, true);
  assert.equal(validateLinkedInScheduledPublishDraft({
    ...image,
    mediaAssets: [],
  }).publishable, false);
});

test("unverified LinkedIn multi-image and video modes cannot be scheduled", () => {
  const multi = validateLinkedInScheduledPublishDraft({
    ...base,
    mediaIds: ["a", "b"],
    mediaAssets: [
      { _id: "a", contentType: "image/jpeg", size: 1024 },
      { _id: "b", contentType: "image/png", size: 1024 },
    ],
  });
  assert.equal(multi.publishMode, "multi_image");
  assert.equal(multi.publishable, false);
  assert.match(multi.blocking.join(" "), /video|multi-image/i);
  const video = validateLinkedInScheduledPublishDraft({
    ...base,
    mediaIds: ["clip"],
    mediaAssets: [{ _id: "clip", contentType: "video/mp4", size: 4096 }],
  });
  assert.equal(video.publishMode, "video");
  assert.equal(video.publishable, false);
});

test("unhealthy LinkedIn connection cannot schedule a post", () => {
  const result = validateLinkedInScheduledPublishDraft({
    ...base, healthStatus: "expired",
  });
  assert.equal(result.publishable, false);
  assert.match(result.blocking.join(" "), /not healthy/i);
});

test("the existing AWS scheduler naming and payload support LinkedIn", () => {
  const name = buildAwsScheduleName({
    platform: "linkedin",
    platformVersionId: "6abc356c9b523f147ecbf422",
  });
  assert.equal(name, "csh-linkedin-6abc356c9b523f147ecbf422");
  assert.deepEqual(
    JSON.parse(buildScheduledReleasePayload("6abc7081e14044c0e1f6ea65")),
    { scheduledReleaseId: "6abc7081e14044c0e1f6ea65" },
  );
});
