import "server-only";

import { InstagramApiError } from "@/lib/instagram";
import { normalizeInstagramContainerStatus } from "@/lib/instagram-publish-logic";

const DEFAULT_GRAPH_VERSION = "v26.0";

function getGraphVersion() {
  return process.env.INSTAGRAM_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION;
}

function graphUrl(path) {
  return new URL(
    `https://graph.instagram.com/${getGraphVersion()}/${String(path).replace(/^\//, "")}`,
  );
}

async function readJsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.error || payload?.error_type) {
    const details = payload?.error || payload || null;
    throw new InstagramApiError(
      payload?.error?.message || payload?.error_message || fallbackMessage,
      details,
    );
  }

  return payload;
}

async function graphGet(path, accessToken, params = {}) {
  const url = graphUrl(path);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  url.searchParams.set("access_token", accessToken);

  return readJsonResponse(
    await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    }),
    "Instagram returned an unexpected response.",
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

  return readJsonResponse(
    await fetch(graphUrl(path), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
      cache: "no-store",
    }),
    "Instagram returned an unexpected response.",
  );
}

function requiredContainerId(payload, fallbackMessage) {
  const providerContainerId = String(payload?.id || "").trim();

  if (!providerContainerId) {
    throw new InstagramApiError(fallbackMessage, payload);
  }

  return providerContainerId;
}

export async function createInstagramImageContainer({
  accountId,
  accessToken,
  imageUrl,
  caption = "",
  isCarouselItem = false,
}) {
  const created = await graphPost(`${accountId}/media`, accessToken, {
    image_url: imageUrl,
    caption: isCarouselItem ? "" : String(caption || ""),
    is_carousel_item: isCarouselItem ? "true" : "",
  });

  return {
    providerContainerId: requiredContainerId(
      created,
      "Instagram accepted the image container request but did not return a container ID.",
    ),
  };
}

export async function createInstagramVideoContainer({
  accountId,
  accessToken,
  videoUrl,
  isCarouselItem = false,
}) {
  const created = await graphPost(`${accountId}/media`, accessToken, {
    media_type: "VIDEO",
    video_url: videoUrl,
    is_carousel_item: isCarouselItem ? "true" : "",
  });

  return {
    providerContainerId: requiredContainerId(
      created,
      "Instagram accepted the video container request but did not return a container ID.",
    ),
  };
}

export async function createInstagramCarouselContainer({
  accountId,
  accessToken,
  childContainerIds,
  caption = "",
}) {
  const children = (Array.isArray(childContainerIds) ? childContainerIds : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (children.length < 2) {
    throw new TypeError("Instagram carousel publishing requires at least two child containers.");
  }

  const created = await graphPost(`${accountId}/media`, accessToken, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption: String(caption || ""),
  });

  return {
    providerContainerId: requiredContainerId(
      created,
      "Instagram accepted the carousel container request but did not return a container ID.",
    ),
  };
}

export async function getInstagramContainerStatus({
  providerContainerId,
  accessToken,
}) {
  const payload = await graphGet(providerContainerId, accessToken, {
    fields: "id,status_code,status",
  });

  return {
    providerContainerId: String(payload?.id || providerContainerId),
    providerStatus: payload?.status_code || payload?.status || null,
    processingState: normalizeInstagramContainerStatus(payload),
  };
}

export async function publishInstagramContainer({
  accountId,
  accessToken,
  providerContainerId,
}) {
  const published = await graphPost(`${accountId}/media_publish`, accessToken, {
    creation_id: providerContainerId,
  });
  const providerPostId = String(published?.id || "").trim();

  if (!providerPostId) {
    throw new InstagramApiError(
      "Instagram accepted the publish request but did not return a media ID.",
      published,
    );
  }

  return { providerPostId };
}

export async function getInstagramPublishedMedia({
  providerPostId,
  accessToken,
}) {
  const media = await graphGet(providerPostId, accessToken, {
    fields: "id,permalink,media_type",
  });

  return {
    providerPostId: String(media?.id || providerPostId),
    providerPostUrl: String(media?.permalink || "").trim(),
    providerMediaType: media?.media_type || null,
  };
}
