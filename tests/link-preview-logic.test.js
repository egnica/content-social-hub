import assert from "node:assert/strict";
import test from "node:test";
import {
  isSupportedPreviewUrl,
  parseLinkPreviewHtml,
} from "../lib/link-preview-logic.js";

test("extracts Open Graph link-card metadata and resolves relative URLs", () => {
  const preview = parseLinkPreviewHtml(
    `<!doctype html><html><head>
      <meta content="Nick &amp; Notes" property="og:site_name">
      <meta property="og:title" content="Voice &amp; Markdown">
      <meta name="description" content="Fallback description">
      <meta property="og:description" content="A better &quot;preview&quot; description">
      <meta property="og:image" content="/images/voice-card.webp">
      <link rel="alternate canonical" href="/blog/voice-to-markdown-workflow">
    </head></html>`,
    "https://nicholasegner.com/blog/voice-to-markdown-workflow?ref=test",
  );

  assert.deepEqual(preview, {
    url: "https://nicholasegner.com/blog/voice-to-markdown-workflow",
    title: "Voice & Markdown",
    description: 'A better "preview" description',
    imageUrl: "https://nicholasegner.com/images/voice-card.webp",
    siteName: "Nick & Notes",
  });
});

test("falls back to Twitter metadata and document title", () => {
  const preview = parseLinkPreviewHtml(
    `<html><head><title>Fallback title</title><meta name="twitter:image" content="https://cdn.example.com/card.jpg"></head></html>`,
    "https://example.com/article",
  );

  assert.equal(preview.title, "Fallback title");
  assert.equal(preview.imageUrl, "https://cdn.example.com/card.jpg");
  assert.equal(preview.url, "https://example.com/article");
});

test("preview URLs must use normal web URL shapes", () => {
  assert.equal(isSupportedPreviewUrl("https://example.com/post"), true);
  assert.equal(isSupportedPreviewUrl("http://example.com/post"), true);
  assert.equal(isSupportedPreviewUrl("ftp://example.com/post"), false);
  assert.equal(
    isSupportedPreviewUrl("https://user:pass@example.com/post"),
    false,
  );
  assert.equal(isSupportedPreviewUrl("not-a-url"), false);
});
