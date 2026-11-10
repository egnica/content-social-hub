import assert from "node:assert/strict";
import test from "node:test";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import * as logic from "../lib/google-business-publish-logic.js";
const parent = "accounts/123/locations/456";
const name = `${parent}/localPosts/post-1`;
const version = { summary: "An update", ctaType: "CALL", ctaUrl: "", mediaIds: [] };

test("STANDARD payload supports absent CTA, link CTA and CALL without native scheduling or media", () => {
  for (const ctaType of ["", "CALL", "BOOK", "ORDER", "SHOP", "LEARN_MORE", "SIGN_UP"]) {
    const payload = logic.googleBusinessPostPayload({ ...version, ctaType, ctaUrl: "https://example.org" });
    assert.equal(payload.topicType, "STANDARD");
    assert.equal(payload.callToAction?.actionType, ctaType || undefined);
    assert.equal(payload.callToAction?.url, ctaType && ctaType !== "CALL" ? "https://example.org" : undefined);
    assert.equal(payload.scheduledTime, undefined); assert.equal(payload.media, undefined);
  }
});

test("verifies returned exact identity and state without inventing a live URL", () => {
  for (const state of ["LIVE", "PROCESSING", "REJECTED", "new-state", "SCHEDULED"]) {
    const post = logic.googleBusinessPostResult({ name, state, searchUrl: "https://google.com.evil.example/post" }, parent);
    assert.equal(post.providerPostUrl, "");
    assert.equal(post.status, state === "LIVE" ? "succeeded" : state === "REJECTED" ? "rejected" : "processing");
  }
  assert.throws(() => logic.googleBusinessPostResult({ name: "accounts/other/locations/456/localPosts/x" }, parent), /identity/);
  assert.throws(() => logic.googleBusinessPostResult({ name }, parent, `${parent}/localPosts/another`), /identity/);
});

test("provider uses exact endpoint, bearer header, bounded no-redirect request and reads recorded resource", async () => {
  const calls = [];
  const api = await loadWithStubs(new URL("../lib/google-business-publisher.js", import.meta.url), {
    ...logic, fetch: async (url, options) => {
      calls.push({ url, options });
      return Response.json(url.includes("pageSize") ? { localPosts: [] } : { name, state: "LIVE", searchUrl: "https://local.google.com/place?lpsid=123" });
    },
  });
  await api.checkGoogleBusinessPostsAccess({ accessToken: "mock", parent });
  await api.createGoogleBusinessPost({ accessToken: "mock", parent, version });
  await api.getGoogleBusinessPost({ accessToken: "mock", parent, name });
  assert.deepEqual(calls.map(call => call.options.method), ["GET", "POST", "GET"]);
  assert.equal(calls[1].url, `https://mybusiness.googleapis.com/v4/${parent}/localPosts`);
  assert.equal(calls[2].url, `https://mybusiness.googleapis.com/v4/${name}`);
  assert.equal(calls[1].options.headers.Authorization, "Bearer mock");
  assert.equal(calls[1].options.redirect, "error");
  assert.ok(calls[1].options.signal);
  assert.equal(JSON.parse(calls[1].options.body).callToAction.url, undefined);
});

test("provider sanitizes disabled/denied/quota responses and rejects malformed accepted payload", async () => {
  for (const status of [400, 401, 403, 429, 503]) {
    const api = await loadWithStubs(new URL("../lib/google-business-publisher.js", import.meta.url), {
      ...logic, fetch: async () => Response.json({ error: { message: "TOKEN-SECRET", details: status === 403 ? [{ reason: "SERVICE_DISABLED" }] : [] } }, { status }),
    });
    await assert.rejects(api.createGoogleBusinessPost({ accessToken: "mock", parent, version }), error => {
      assert.equal(error.status, status); assert.ok(!error.message.includes("TOKEN-SECRET"));
      return true;
    });
  }
  const bad = await loadWithStubs(new URL("../lib/google-business-publisher.js", import.meta.url), {
    ...logic, fetch: async () => Response.json({ summary: "accepted without identity" }),
  });
  await assert.rejects(bad.createGoogleBusinessPost({ accessToken: "mock", parent, version }), /identity/);
});


test("image posts send exactly one PHOTO source URL and reject missing/unrequested sources", () => {
  const imageVersion = { ...version, mediaIds: ["image-id"] };
  const signed = "https://private-bucket.s3.us-east-2.amazonaws.com/photo.png?X-Amz-Signature=short-lived";
  const body = logic.googleBusinessPostPayload(imageVersion, signed);
  assert.deepEqual(body.media, [{ mediaFormat: "PHOTO", sourceUrl: signed }]);
  assert.equal(body.scheduledTime, undefined);
  assert.throws(() => logic.googleBusinessPostPayload(imageVersion), /Invalid URL|photo source/);
  assert.throws(() => logic.googleBusinessPostPayload(imageVersion, "http://example.test/photo.jpg"), /HTTPS/);
  assert.throws(() => logic.googleBusinessPostPayload(version, signed), /text-only/);
});
