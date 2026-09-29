import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  isSupportedPreviewUrl,
  parseLinkPreviewHtml,
} from "@/lib/link-preview-logic";

const MAX_HTML_BYTES = 1_500_000;
const MAX_REDIRECTS = 4;
const FETCH_TIMEOUT_MS = 8_000;

function isPrivateIpv4(address) {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase();

  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) {
    const mappedIpv4 = normalized.slice("::ffff:".length);
    return isPrivateIpv4(mappedIpv4);
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("ff")) return true;

  const firstGroup = Number.parseInt(normalized.split(":")[0] || "0", 16);
  return Number.isInteger(firstGroup) && (firstGroup & 0xffc0) === 0xfe80;
}

function isPrivateAddress(address) {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

async function assertPublicHttpUrl(value) {
  if (!isSupportedPreviewUrl(value)) {
    throw new TypeError("Link preview requires a valid http or https URL.");
  }

  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new TypeError("Link preview URL must use a public hostname.");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new TypeError("Link preview URL must use a public address.");
    }
    return url.toString();
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new TypeError("Link preview URL must resolve to a public address.");
  }

  return url.toString();
}

async function fetchPreviewHtml(initialUrl) {
  let currentUrl = await assertPublicHttpUrl(initialUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;

    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "User-Agent":
            "Mozilla/5.0 (compatible; ContentSocialHub/1.0; +https://nicholasegner.com/)",
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Link preview redirect was missing a location.");
      if (redirectCount === MAX_REDIRECTS) {
        throw new Error("Link preview followed too many redirects.");
      }

      currentUrl = await assertPublicHttpUrl(
        new URL(location, currentUrl).toString(),
      );
      continue;
    }

    if (!response.ok) {
      throw new Error(`Link preview request failed with status ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      return { finalUrl: currentUrl, html: "" };
    }

    const contentLength = Number.parseInt(
      response.headers.get("content-length") || "0",
      10,
    );
    if (contentLength > MAX_HTML_BYTES) {
      throw new Error("Link preview page is too large to inspect safely.");
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    return { finalUrl: currentUrl, html };
  }

  throw new Error("Unable to resolve link preview URL.");
}

export async function fetchLinkPreviewMetadata(value) {
  const { finalUrl, html } = await fetchPreviewHtml(value);
  return parseLinkPreviewHtml(html, finalUrl);
}
