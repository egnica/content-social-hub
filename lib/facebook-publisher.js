import "server-only";

import { createHmac } from "node:crypto";
import { FacebookApiError } from "@/lib/facebook";
import { requireEnv } from "@/lib/env";
import { buildFacebookPostUrl } from "@/lib/facebook-publish-logic";

const DEFAULT_GRAPH_VERSION = "v26.0";

function getGraphVersion() {
  return process.env.META_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION;
}

function createAppSecretProof(accessToken) {
  return createHmac("sha256", requireEnv("META_APP_SECRET"))
    .update(accessToken)
    .digest("hex");
}

async function readGraphResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error) {
    throw new FacebookApiError(
      payload?.error?.message || "Facebook returned an unexpected response.",
      payload?.error || payload,
    );
  }

  return payload;
}

function graphUrl(path) {
  return new URL(
    `https://graph.facebook.com/${getGraphVersion()}/${String(path).replace(/^\//, "")}`,
  );
}

async function graphGet(path, accessToken, params = {}) {
  const url = graphUrl(path);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("appsecret_proof", createAppSecretProof(accessToken));

  return readGraphResponse(
    await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
  );
}

async function graphPost(path, accessToken, params = {}) {
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      body.set(key, String(value));
    }
  }

  body.set("access_token", accessToken);
  body.set("appsecret_proof", createAppSecretProof(accessToken));

  return readGraphResponse(
    await fetch(graphUrl(path), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
      cache: "no-store",
    }),
  );
}

export async function publishFacebookPageFeed({
  pageId,
  pageAccessToken,
  message = "",
  link = "",
}) {
  const created = await graphPost(`${pageId}/feed`, pageAccessToken, {
    message,
    link,
  });
  const providerPostId = String(created?.id || "").trim();

  if (!providerPostId) {
    throw new FacebookApiError(
      "Facebook accepted the request but did not return a post ID.",
    );
  }

  let providerPostUrl = buildFacebookPostUrl(pageId, providerPostId);

  try {
    const post = await graphGet(providerPostId, pageAccessToken, {
      fields: "id,permalink_url",
    });

    if (post?.permalink_url) {
      providerPostUrl = String(post.permalink_url);
    }
  } catch {
    // The remote post already exists. Keep the deterministic Page/post URL fallback
    // rather than converting a successful publish into a retryable failure.
  }

  return {
    providerPostId,
    providerPostUrl,
  };
}
