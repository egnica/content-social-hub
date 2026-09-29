import assert from "node:assert/strict";
import test from "node:test";
import {
  getFacebookPublishControlState,
  isAttemptForRevision,
} from "../lib/facebook-publish-state.js";

test("successful current revision stays locked against duplicate publishing", () => {
  assert.deepEqual(
    getFacebookPublishControlState({
      status: "succeeded",
      publishedRevision: 4,
      revision: 4,
    }),
    { mode: "published", canSubmit: false, label: "Published" },
  );
});

test("a new revision is publishable even when an older revision succeeded", () => {
  assert.deepEqual(
    getFacebookPublishControlState({
      status: "succeeded",
      publishedRevision: 3,
      revision: 4,
    }),
    { mode: "ready", canSubmit: true, label: "Publish Now" },
  );
});

test("processing and ambiguous results stay locked", () => {
  assert.equal(
    getFacebookPublishControlState({ status: "processing", revision: 2 }).mode,
    "processing",
  );
  assert.equal(
    getFacebookPublishControlState({ status: "unknown", revision: 2 }).mode,
    "locked",
  );
  assert.equal(
    getFacebookPublishControlState({ status: "unknown", revision: 2 }).canSubmit,
    false,
  );
});

test("only a known failed attempt exposes retry", () => {
  assert.deepEqual(
    getFacebookPublishControlState({ status: "failed", revision: 5 }),
    { mode: "retry", canSubmit: true, label: "Retry Publish" },
  );
});

test("attempt state only controls the revision it belongs to", () => {
  assert.equal(
    isAttemptForRevision({ platformVersionRevision: 7 }, 7),
    true,
  );
  assert.equal(
    isAttemptForRevision({ platformVersionRevision: 6 }, 7),
    false,
  );
  assert.equal(isAttemptForRevision(null, 7), false);
});
