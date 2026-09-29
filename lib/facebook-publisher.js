import "server-only";

import { createHmac } from "node:crypto";
import { FacebookApiError } from "@/lib/facebook";
import { requireEnv } from "@/lib/env";
import {
  buildFacebookPostUrl,
  buildFacebookVideoUrl,
  normalizeFacebookVideoProcessingStatus,
} from "@/lib/facebook-publish-logic";

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

function graphUrl(path, host = "graph.facebook.com") {
  return new URL(
    `https://${host}/${getGraphVersion()}/${String(path).replace(/^\//, "")}`,
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

async function graphPost(path, accessToken, params = {}, host = "graph.facebook.com") {
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      body.set(key, String(value));
    }
  }

  body.set("access_token", accessToken);
  body.set("appsecret_proof", createAppSecretProof(accessToken));

  return readGraphResponse(
    await fetch(graphUrl(path, host), {
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

async function graphPostMultipart(
  path,
  accessToken,
  {
    bytes,
    contentType,
    filename,
    fileField = "source",
    params = {},
    host = "graph.facebook.com",
  },
) {
  const body = new FormData();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      body.set(key, String(value));
    }
  }

  body.set("access_token", accessToken);
  body.set("appsecret_proof", createAppSecretProof(accessToken));
  body.set(
    fileField,
    new Blob([bytes], { type: contentType || "application/octet-stream" }),
    filename || "facebook-media",
  );

  return readGraphResponse(
    await fetch(graphUrl(path, host), {
      method: "POST",
      headers: { Accept: "application/json" },
      body,
      cache: "no-store",
    }),
  );
}

async function resolvePublishedPostResult(pageId, pageAccessToken, providerPostId) {
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

export async function uploadFacebookPagePhoto({
  pageId,
  pageAccessToken,
  bytes,
  contentType,
  filename,
}) {
  const created = await graphPostMultipart(`${pageId}/photos`, pageAccessToken, {
    bytes,
    contentType,
    filename,
    params: { published: "false" },
  });
  const providerMediaId = String(created?.id || "").trim();

  if (!providerMediaId) {
    throw new FacebookApiError(
      "Facebook accepted the photo upload but did not return a photo ID.",
    );
  }

  return { providerMediaId };
}

export async function publishFacebookPageImageFeed({
  pageId,
  pageAccessToken,
  message = "",
  providerMediaIds = [],
}) {
  const params = {};
  const normalizedMessage = String(message || "").trim();

  if (normalizedMessage) params.message = normalizedMessage;

  providerMediaIds.forEach((providerMediaId, index) => {
    params[`attached_media[${index}]`] = JSON.stringify({
      media_fbid: String(providerMediaId),
    });
  });

  const created = await graphPost(`${pageId}/feed`, pageAccessToken, params);
  const providerPostId = String(created?.id || "").trim();

  if (!providerPostId) {
    throw new FacebookApiError(
      "Facebook accepted the image post but did not return a post ID.",
    );
  }

  return resolvePublishedPostResult(pageId, pageAccessToken, providerPostId);
}

export async function startFacebookPageVideoUpload({
  pageId,
  pageAccessToken,
  fileSize,
}) {
  const created = await graphPost(
    `${pageId}/videos`,
    pageAccessToken,
    {
      upload_phase: "start",
      file_size: Number(fileSize),
    },
    "graph-video.facebook.com",
  );
  const uploadSessionId = String(created?.upload_session_id || "").trim();
  const providerVideoId = String(created?.video_id || created?.id || "").trim();
  const startOffset = Number(created?.start_offset ?? 0);
  const endOffset = Number(created?.end_offset ?? 0);

  if (
    !uploadSessionId ||
    !providerVideoId ||
    !Number.isFinite(startOffset) ||
    !Number.isFinite(endOffset)
  ) {
    throw new FacebookApiError(
      "Facebook did not return a usable resumable video upload session.",
    );
  }

  return {
    uploadSessionId,
    providerVideoId,
    startOffset,
    endOffset,
  };
}

export async function transferFacebookPageVideoChunk({
  pageId,
  pageAccessToken,
  uploadSessionId,
  startOffset,
  bytes,
  contentType,
  filename,
}) {
  const transferred = await graphPostMultipart(
    `${pageId}/videos`,
    pageAccessToken,
    {
      bytes,
      contentType,
      filename,
      fileField: "video_file_chunk",
      host: "graph-video.facebook.com",
      params: {
        upload_phase: "transfer",
        upload_session_id: uploadSessionId,
        start_offset: Number(startOffset),
      },
    },
  );
  const nextStartOffset = Number(transferred?.start_offset);
  const nextEndOffset = Number(transferred?.end_offset);

  if (!Number.isFinite(nextStartOffset) || !Number.isFinite(nextEndOffset)) {
    throw new FacebookApiError(
      "Facebook did not return the next video upload offsets.",
    );
  }

  return {
    startOffset: nextStartOffset,
    endOffset: nextEndOffset,
  };
}

export async function finishFacebookPageVideoUpload({
  pageId,
  pageAccessToken,
  uploadSessionId,
  description = "",
  title = "",
}) {
  const finished = await graphPost(
    `${pageId}/videos`,
    pageAccessToken,
    {
      upload_phase: "finish",
      upload_session_id: uploadSessionId,
      description: String(description || "").trim(),
      title: String(title || "").trim(),
    },
    "graph-video.facebook.com",
  );

  if (finished?.success === false) {
    throw new FacebookApiError(
      "Facebook did not accept the completed video upload.",
      finished,
    );
  }

  return finished;
}

export async function getFacebookPageVideoStatus({
  pageId,
  pageAccessToken,
  providerVideoId,
}) {
  const video = await graphGet(providerVideoId, pageAccessToken, {
    fields: "id,permalink_url,status",
  });
  const normalizedVideoId = String(video?.id || providerVideoId || "").trim();

  return {
    providerVideoId: normalizedVideoId,
    providerPostId: normalizedVideoId,
    providerPostUrl:
      String(video?.permalink_url || "").trim() ||
      buildFacebookVideoUrl(pageId, normalizedVideoId),
    processingState: normalizeFacebookVideoProcessingStatus(video),
    providerStatus: video?.status || null,
  };
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

  return resolvePublishedPostResult(pageId, pageAccessToken, providerPostId);
}
