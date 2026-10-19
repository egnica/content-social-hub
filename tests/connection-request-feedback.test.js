import assert from "node:assert/strict";
import test from "node:test";
import {
  CONNECTION_REQUEST_PLATFORM_LABELS,
  labelRequestPlatform,
  makeConnectionRequestNotification,
} from "../lib/connection-request-feedback.js";

test("all five supported providers generate explicit send confirmations", () => {
  assert.equal(Object.keys(CONNECTION_REQUEST_PLATFORM_LABELS).length, 5);
  for (const platform of Object.keys(CONNECTION_REQUEST_PLATFORM_LABELS)) {
    const notification = makeConnectionRequestNotification({ platform, email: "recipient@example.com" });
    assert.equal(notification.type, "success");
    assert.equal(notification.title, "Connection request sent!");
    assert.match(notification.message, /recipient@example.com/);
    assert.ok(notification.message.includes(labelRequestPlatform(platform)));
    assert.match(notification.detail, /48 hours/);
  }
});

test("an API error never reports that the connection email was sent", () => {
  const notification = makeConnectionRequestNotification({
    platform: "google_business_profile", error: "Resend rejected the email.",
  });
  assert.equal(notification.type, "error");
  assert.equal(notification.title, "Connection request failed");
  assert.match(notification.message, /Google Business Profile: Resend rejected/);
  assert.doesNotMatch(notification.message, /sent to/);
  assert.match(notification.detail, /history/);
});

test("empty server errors must not be mislabeled as successful emails", () => {
  const notification = makeConnectionRequestNotification({ platform: "facebook", error: "" });
  assert.equal(notification.type, "error");
  assert.match(notification.message, /Unable to send this request/);
});

test("an unknown provider cannot be presented as a Facebook request", () => {
  assert.equal(labelRequestPlatform("unexpected"), "Social account");
});
