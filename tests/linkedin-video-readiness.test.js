import assert from "node:assert/strict";
import test from "node:test";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import { linkedInPostText, linkedinPostUrl } from "../lib/linkedin-publish-logic.js";

const videoUrn = "urn:li:video:sample-video";
const memberId = "member-1";
async function fixture(responses) {
  const calls = [];
  const publisher = await loadWithStubs(new URL("../lib/linkedin-publisher.js", import.meta.url), {
    linkedInPostText, linkedinPostUrl,
    fetch: async (url, options) => {
      calls.push({ url, options });
      const response = responses.shift();
      assert.ok(response, "unexpected extra provider request");
      return new Response(JSON.stringify({ id: videoUrn, owner: `urn:li:person:${memberId}`, ...response.body }), { status: response.status || 200 });
    },
  });
  return { publisher, calls };
}
const input = { accessToken: "mock-token", memberId, videoUrn, maxChecks: 2, intervalMs: 0 };

test("video processing waits for AVAILABLE using only read-only status calls", async () => {
  const f = await fixture([{ body: { status: "PROCESSING" } }, { body: { status: "AVAILABLE" } }]);
  await f.publisher.waitForLinkedInVideo(input);
  assert.equal(f.calls.length, 2);
  for (const call of f.calls) {
    assert.equal(call.options.method, "GET");
    assert.match(call.url, /rest\/videos\/urn%3Ali%3Avideo%3Asample-video$/);
    assert.equal(call.options.headers["X-Restli-Protocol-Version"], "2.0.0");
    assert.ok(call.options.headers["Linkedin-Version"]);
  }
});

test("processing timeout, processing failure and unknown states do not claim readiness", async () => {
  for (const responses of [
    [{ body: { status: "PROCESSING" } }, { body: { status: "PROCESSING" } }],
    [{ body: { status: "PROCESSING_FAILED" } }],
    [{ body: { status: "UNRECOGNIZED" } }],
  ]) {
    const f = await fixture(responses);
    await assert.rejects(f.publisher.waitForLinkedInVideo(input), /processing|process|unknown/);
    assert.ok(f.calls.length <= 2);
  }
});

test("readiness requires the exact video and member owner", async () => {
  for (const body of [{ id: "urn:li:video:another-video" }, { owner: "urn:li:person:another-member" }]) {
    const f = await fixture([{ body: { status: "AVAILABLE", ...body } }]);
    await assert.rejects(f.publisher.waitForLinkedInVideo(input), /ownership/);
  }
});

test("invalid video references and denied status reads fail without claiming readiness", async () => {
  const invalid = await fixture([]);
  await assert.rejects(invalid.publisher.waitForLinkedInVideo({ ...input, videoUrn: "https://other.example/video" }), /invalid/);
  assert.equal(invalid.calls.length, 0);
  const denied = await fixture([{ status: 403 }]);
  await assert.rejects(denied.publisher.waitForLinkedInVideo(input), { name: "LinkedInPublishApiError", status: 403 });
});
