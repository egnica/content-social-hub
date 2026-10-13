import test from "node:test";
import assert from "node:assert/strict";
import { YOUTUBE_REQUIRED_SCOPES, getYouTubeHealth, selectYouTubeChannel, assertSameYouTubeChannel } from "../lib/youtube-connection-logic.js";
const expiry = "2026-10-15T00:00:00Z";
const now = new Date("2026-10-13T00:00:00Z");
test("YouTube identity requires exactly one real channel ID and title", () => {
  assert.deepEqual(selectYouTubeChannel([{ id: "UC123", snippet: { title: "A Channel" } }]), {
    providerAccountId: "UC123", accountName: "A Channel", pictureUrl: "",
  });
  assert.throws(() => selectYouTubeChannel([]), /No YouTube channel/);
  assert.throws(() => selectYouTubeChannel([{ id: "A", snippet: { title: "A" } }, { id: "B", snippet: { title: "B" } }]), /multiple channels/);
  assert.throws(() => selectYouTubeChannel([{ snippet: { title: "Fake" } }]), /verified channel/);
});
test("reconnect cannot silently swap channel identity", () => {
  assert.doesNotThrow(() => assertSameYouTubeChannel("UC123", "UC123"));
  assert.throws(() => assertSameYouTubeChannel("UC123", "UC999"), /different YouTube channel/);
});
test("YouTube health requires offline refresh and both scopes", () => {
  const baseline = { grantedScopes: YOUTUBE_REQUIRED_SCOPES, hasRefreshToken: true, channelId: "UC123", tokenExpiresAt: expiry, now };
  assert.equal(getYouTubeHealth(baseline).canPublish, true);
  assert.equal(getYouTubeHealth({ ...baseline, hasRefreshToken: false }).canPublish, false);
  assert.equal(getYouTubeHealth({ ...baseline, grantedScopes: YOUTUBE_REQUIRED_SCOPES.slice(0,1) }).healthStatus, "permission_problem");
  assert.equal(getYouTubeHealth({ ...baseline, tokenExpiresAt: "2026-10-12T00:00:00Z" }).healthStatus, "expired");
});
