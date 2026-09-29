function decodeHtmlEntities(value) {
  return String(value || "").replace(
    /&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,
    (match, entity) => {
      const normalized = entity.toLowerCase();
      if (normalized.startsWith("#x")) {
        const codePoint = Number.parseInt(normalized.slice(2), 16);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : match;
      }
      if (normalized.startsWith("#")) {
        const codePoint = Number.parseInt(normalized.slice(1), 10);
        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : match;
      }

      return {
        amp: "&",
        quot: '"',
        apos: "'",
        lt: "<",
        gt: ">",
        nbsp: " ",
      }[normalized] || match;
    },
  );
}

function parseTagAttributes(tag) {
  const source = String(tag || "")
    .replace(/^<\w+\s*/i, "")
    .replace(/\/?>\s*$/i, "");
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = pattern.exec(source))) {
    const name = String(match[1] || "").toLowerCase();
    if (!name || Object.hasOwn(attributes, name)) continue;
    attributes[name] = decodeHtmlEntities(
      match[2] ?? match[3] ?? match[4] ?? "",
    );
  }

  return attributes;
}

function cleanText(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(value, baseUrl) {
  if (!value) return "";

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function firstValue(map, keys) {
  for (const key of keys) {
    const value = map.get(key);
    if (value) return value;
  }

  return "";
}

export function isSupportedPreviewUrl(value) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

export function parseLinkPreviewHtml(html, sourceUrl) {
  const source = String(html || "");
  const meta = new Map();

  for (const tag of source.match(/<meta\b[^>]*>/gi) || []) {
    const attributes = parseTagAttributes(tag);
    const key = String(
      attributes.property || attributes.name || "",
    ).toLowerCase();
    const value = cleanText(attributes.content || "");
    if (key && value && !meta.has(key)) meta.set(key, value);
  }

  let canonicalUrl = "";
  for (const tag of source.match(/<link\b[^>]*>/gi) || []) {
    const attributes = parseTagAttributes(tag);
    const rel = String(attributes.rel || "")
      .toLowerCase()
      .split(/\s+/);
    if (rel.includes("canonical") && attributes.href) {
      canonicalUrl = absoluteUrl(attributes.href, sourceUrl);
      break;
    }
  }

  const titleMatch = source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title =
    firstValue(meta, ["og:title", "twitter:title"]) ||
    cleanText(titleMatch?.[1] || "");
  const description = firstValue(meta, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  const imageUrl = absoluteUrl(
    firstValue(meta, [
      "og:image:secure_url",
      "og:image",
      "twitter:image",
      "twitter:image:src",
    ]),
    sourceUrl,
  );
  const providerUrl = absoluteUrl(meta.get("og:url") || "", sourceUrl);

  return {
    url: canonicalUrl || providerUrl || sourceUrl,
    title,
    description,
    imageUrl,
    siteName: firstValue(meta, ["og:site_name", "application-name"]),
  };
}
