import "server-only";

import { createHmac } from "node:crypto";
import { requireEnv } from "@/lib/env";
import { buildFacebookPostUrl } from "@/lib/facebook-publish-logic";

const DEFAULT_GRAPH_VERSION = "v26.0";

export class FacebookPublishApiError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "FacebookPublishApiError";
    this.details = details;
  }
}

function getGraphVersion() {
  return process.env.META_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION;
}

function createAppSecretProof(accessToken) {
  const appSecret = requireEnv("META_APP_SECRET");
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

async function readGraphResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    throw new FacebookPublishApiError(
      payload?.error?.message || "Facebook returned an unexpected publishing response.",
      payload?.error || payload,
    );
  }
  return payload;
}

async function graphPost(path, accessToken, params = {}) {
  const url = `https://graph.facebook.com/${getGraphVersion()}/${path.replace(/^\//, "")}`;
  const body = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      body.set(key, String(value));
    }
  });
  body.set("access_token", accessToken);
  body.set("appsecret_proof", createAppSecretProof(accessToken));

  return readGraphResponse(
    await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    }),
  );
}

async function graphGet(path, accessToken, params = {}) {
  const url = new URL(
    `https://graph.facebook.com/${getGraphVersion()}/${path.replace(/^\//, "")}`,
  );
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("appsecret_proof", createAppSecretProof(accessToken));

  return readGraphResponse(
    await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
  );
}

export async function publishFacebookPageFeedPost(
  pageId,
  pageAccessToken,
  payload,
) {
  const published = await graphPost(`${pageId}/feed`, pageAccessToken, payload);
  const providerPostId = String(published?.id || "").trim();
  if (!providerPostId) {
    throw new FacebookPublishApiError(
      "Facebook accepted the request but did not return a post ID.",
    );
  }

  let providerPostUrl = buildFacebookPostUrl(pageId, providerPostId);
  let permalinkRecovered = false;

  try {
    const post = await graphGet(providerPostId, pageAccessToken, {
      fields: "id,permalink_url",
    });
    if (post?.permalink_url) {
      providerPostUrl = String(post.permalink_url);
      permalinkRecovered = true;
    }
  } catch {
    // The publish already succeeded. Preserve the deterministic exact-post fallback.
  }

  return { providerPostId, providerPostUrl, permalinkRecovered };
}
