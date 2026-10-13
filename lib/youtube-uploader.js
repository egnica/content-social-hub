const API = "https://www.googleapis.com";
const CHUNK_BYTES = 8 * 1024 * 1024;

export class YouTubeUploadError extends Error {
  constructor(message, status = 0, definitive = false) {
    super(message);
    this.name = "YouTubeUploadError";
    this.status = status;
    this.definitive = definitive;
  }
}
export function youtubeVideoUrl(videoId) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(String(videoId || "")))
    throw new TypeError("YouTube did not return a valid video ID.");
  return `https://www.youtube.com/watch?v=${videoId}`;
}
export function parseYouTubeUploadRange(value, total) {
  if (!value) return 0;
  const match = /^bytes=0-(\d+)$/.exec(value);
  const last = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(last) || last < 0 || last >= total)
    throw new YouTubeUploadError("YouTube returned an invalid upload offset.");
  return last + 1;
}
export function isAllowedYouTubeUploadSession(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "www.googleapis.com" &&
      u.pathname === "/upload/youtube/v3/videos" && u.searchParams.has("upload_id");
  } catch { return false; }
}
async function send(url, options) {
  try { return await fetch(url, { ...options, cache: "no-store", redirect: "error",
    signal: AbortSignal.timeout(90000) }); }
  catch { throw new YouTubeUploadError("YouTube upload request is uncertain; resume or inspect the saved session, never create another video."); }
}
async function videoResult(response) {
  const value = await response.json().catch(() => null);
  if (!value?.id) throw new YouTubeUploadError("YouTube accepted upload but did not return a video ID.");
  return { videoId: value.id, videoUrl: youtubeVideoUrl(value.id), providerStatus: value.status?.uploadStatus || "uploaded" };
}
export async function startYouTubeResumableUpload({ accessToken, title, description, privacyStatus, madeForKids, size, mimeType }) {
  if (!Number.isSafeInteger(size) || size <= 0 || !String(mimeType).startsWith("video/"))
    throw new TypeError("A video and known byte size are required.");
  const body = JSON.stringify({ snippet: { title, description }, status: { privacyStatus, selfDeclaredMadeForKids: madeForKids } });
  const response = await send(`${API}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(size), "X-Upload-Content-Type": mimeType }, body,
  });
  if (!response.ok) throw new YouTubeUploadError("YouTube refused to start the resumable upload.", response.status, response.status >= 400 && response.status < 500 && response.status !== 429);
  const location = response.headers.get("location");
  if (!isAllowedYouTubeUploadSession(location))
    throw new YouTubeUploadError("YouTube did not provide a trusted resumable session URL.");
  return location;
}
export async function probeYouTubeResumableUpload({ sessionUrl, accessToken, size }) {
  if (!isAllowedYouTubeUploadSession(sessionUrl)) throw new TypeError("Invalid YouTube upload session.");
  const response = await send(sessionUrl, { method: "PUT", headers: {
    Authorization: `Bearer ${accessToken}`, "Content-Length": "0", "Content-Range": `bytes */${size}`,
  } });
  if (response.status === 308) return { offset: parseYouTubeUploadRange(response.headers.get("range"), size) };
  if (response.ok) return { completed: await videoResult(response) };
  throw new YouTubeUploadError(response.status === 404 ?
    "YouTube upload session expired. Manual reconciliation is required before starting another upload." :
    "YouTube upload offset could not be verified.", response.status);
}
export async function sendYouTubeUploadChunk({ sessionUrl, accessToken, mimeType, size, offset, bytes }) {
  if (!isAllowedYouTubeUploadSession(sessionUrl)) throw new TypeError("Invalid YouTube upload session.");
  const end = offset + bytes.byteLength;
  if (!Number.isSafeInteger(offset) || offset < 0 || end > size || bytes.byteLength <= 0 ||
      (end < size && bytes.byteLength % (256 * 1024) !== 0))
    throw new TypeError("Invalid resumable YouTube chunk boundaries.");
  const response = await send(sessionUrl, { method: "PUT", headers: {
    Authorization: `Bearer ${accessToken}`, "Content-Type": mimeType,
    "Content-Range": `bytes ${offset}-${end - 1}/${size}`,
  }, body: bytes });
  if (response.status === 308)
    return { offset: parseYouTubeUploadRange(response.headers.get("range"), size) };
  if (response.ok) return { completed: await videoResult(response) };
  throw new YouTubeUploadError("YouTube chunk outcome needs reconciliation with the saved session.", response.status);
}
export function nextYouTubeChunkEnd(offset, size) { return Math.min(size, offset + CHUNK_BYTES); }
export async function readYouTubeVideoProcessing({ accessToken, videoId }) {
  const response = await send(`${API}/youtube/v3/videos?part=status,processingDetails&id=${encodeURIComponent(videoId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new YouTubeUploadError("YouTube processing status is unavailable.", response.status);
  const result = await response.json().catch(() => null);
  const video = result?.items?.find(item => item.id === videoId);
  if (!video) throw new YouTubeUploadError("YouTube video is not visible to this authorized channel yet.");
  return { uploadStatus: video.status?.uploadStatus || "", processingStatus: video.processingDetails?.processingStatus || "unknown",
    privacyStatus: video.status?.privacyStatus || "" };
}
export async function setYouTubeThumbnail({ accessToken, videoId, bytes, mimeType }) {
  if (!["image/png", "image/jpeg"].includes(mimeType) || !bytes?.byteLength || bytes.byteLength > 50 * 1024 * 1024)
    throw new TypeError("Custom thumbnail must be a JPEG or PNG no larger than 50 MiB.");
  const response = await send(`${API}/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": mimeType }, body: bytes,
  });
  if (!response.ok) throw new YouTubeUploadError("YouTube did not confirm the custom thumbnail; check channel eligibility.", response.status);
  return true;
}
