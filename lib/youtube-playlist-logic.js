export const YOUTUBE_PLAYLIST_WRITE_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{10,60}$/;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function validPlaylistId(id) { return PLAYLIST_ID_RE.test(String(id || '')); }
export function validVideoId(id) { return VIDEO_ID_RE.test(String(id || '')); }
export function normalizePlaylistIds(ids) {
  if (!Array.isArray(ids)) throw new TypeError('Playlists must be a list.');
  const unique = [...new Set(ids.map(x => String(x || '').trim()))];
  if (unique.length > 25 || unique.some(id => !validPlaylistId(id)))
    throw new TypeError('Choose up to 25 valid YouTube playlists.');
  return unique;
}
export function hasPlaylistWritePermission(scopes) {
  return Array.isArray(scopes) && scopes.includes(YOUTUBE_PLAYLIST_WRITE_SCOPE);
}
export function validatePlaylistName(name) {
  const title = String(name || '').trim();
  if (!title || title.length > 150 || /[<>]/.test(title))
    throw new TypeError('Playlist name must be 1–150 characters without angle brackets.');
  return title;
}
export function validatePlaylistVisibility(value) {
  if (!['private','unlisted','public'].includes(value))
    throw new TypeError('Choose Private, Unlisted, or Public playlist visibility.');
  return value;
}
export function playlistListItems(payload, channelId) {
  if (!channelId) throw new TypeError('Connected YouTube channel missing.');
  return (Array.isArray(payload?.items) ? payload.items : [])
    .filter(p => validPlaylistId(p.id) && p.snippet?.channelId === channelId)
    .map(p => ({ id: p.id, title: String(p.snippet?.title || '').slice(0,150),
      privacyStatus: ['private','unlisted','public'].includes(p.status?.privacyStatus) ? p.status.privacyStatus : 'unknown' }));
}
export function playlistMembershipPresent(payload, videoId) {
  return validVideoId(videoId) && Array.isArray(payload?.items) && payload.items.some(item =>
    item.snippet?.resourceId?.kind === 'youtube#video' && item.snippet?.resourceId?.videoId === videoId);
}
export function playlistAssignmentKey(id) {
  if (!validPlaylistId(id)) throw new TypeError('Invalid playlist ID.');
  return `playlistAssignments.${id}`;
}
