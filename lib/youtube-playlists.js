import 'server-only';
import { getDb } from '@/lib/mongodb';
import { toObjectId } from '@/lib/ids';
import { decryptSecret } from '@/lib/secure-values';
import { refreshSocialConnectionHealth } from '@/lib/connections';
import {
 hasPlaylistWritePermission, normalizePlaylistIds, playlistAssignmentKey,
 playlistListItems, playlistMembershipPresent, validPlaylistId,
 validVideoId, validatePlaylistName, validatePlaylistVisibility,
} from '@/lib/youtube-playlist-logic';

const ROOT = 'https://www.googleapis.com/youtube/v3';
export class YouTubePlaylistError extends Error {
  constructor(message, status=0) { super(message); this.name='YouTubePlaylistError'; this.status=status; }
}
async function callYouTube(path, accessToken, {method='GET',body}={}) {
  const response=await fetch(`${ROOT}/${path}`,{
    method, cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000),
    headers:{Authorization:`Bearer ${accessToken}`,Accept:'application/json',
      ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
  }).catch(()=>{throw new YouTubePlaylistError('YouTube playlist request could not be confirmed. Inspect before retrying.');});
  if(!response.ok)throw new YouTubePlaylistError('YouTube declined the playlist request. Check channel permissions and selected playlist.',response.status);
  return response.json().catch(()=>{throw new YouTubePlaylistError('YouTube returned an invalid playlist response.');});
}
export async function getPlaylistContext(versionId) {
  const _id=toObjectId(versionId);
  if(!_id)throw new TypeError('YouTube destination is not valid.');
  const db=await getDb();
  const versions=db.collection('platform_versions');
  const version=await versions.findOne({_id,platform:'youtube',active:{$ne:false}});
  if(!version)throw new TypeError('YouTube destination no longer exists.');
  await refreshSocialConnectionHealth(String(version.socialConnectionId));
  const connection=await db.collection('social_connections').findOne({
    _id:version.socialConnectionId,platform:'youtube',clientId:version.clientId,
    providerAccountId:version.providerAccountId,
  });
  if(!connection || !connection.tokenEncrypted || !['healthy','expiring_soon'].includes(connection.healthStatus) ||
    connection.capabilities?.canPublish!==true)
    throw new TypeError('Reconnect the selected YouTube channel before managing playlists.');
  return {db,version,connection,channelId:String(connection.providerAccountId),
    accessToken:decryptSecret(connection.tokenEncrypted),
    canManage:hasPlaylistWritePermission(connection.grantedScopes)};
}
export async function listYouTubePlaylists(ctx) {
  const list=[];let pageToken='';
  for(let page=0;page<20;page++) {
    const params=new URLSearchParams({part:'snippet,status',mine:'true',maxResults:'50'});
    if(pageToken)params.set('pageToken',pageToken);
    const response=await callYouTube(`playlists?${params}`,ctx.accessToken);
    list.push(...playlistListItems(response,ctx.channelId));
    if(!response.nextPageToken)return list;
    pageToken=String(response.nextPageToken);
  }
  throw new YouTubePlaylistError('Too many playlist pages. Narrow the channel playlist collection.');
}
export async function getYouTubePlaylistChoices(versionId) {
  const ctx=await getPlaylistContext(versionId);
  return {playlists:await listYouTubePlaylists(ctx),canManage:ctx.canManage,
    reconnectUrl:`/api/connections/youtube/start?clientId=${encodeURIComponent(String(ctx.version.clientId))}&connectionId=${encodeURIComponent(String(ctx.connection._id))}`};
}
export async function createYouTubePlaylist(versionId,{title,privacyStatus='private'}={}) {
  const ctx=await getPlaylistContext(versionId);
  if(!ctx.canManage)throw new YouTubePlaylistError('Reconnect YouTube and approve playlist management before creating playlists.',403);
  const cleanTitle=validatePlaylistName(title);
  const cleanPrivacy=validatePlaylistVisibility(privacyStatus);
  const created=await callYouTube('playlists?part=snippet,status',ctx.accessToken,{method:'POST',
    body:{snippet:{title:cleanTitle},status:{privacyStatus:cleanPrivacy}}});
  if(!validPlaylistId(created?.id)||created.snippet?.channelId!==ctx.channelId)
    throw new YouTubePlaylistError('Playlist was created or accepted, but channel identity could not be confirmed. Refresh; do not retry blindly.');
  return {id:created.id,title:cleanTitle,privacyStatus:cleanPrivacy};
}
async function membership(ctx,playlistId,videoId) {
  const params=new URLSearchParams({part:'snippet',playlistId,videoId,maxResults:'50'});
  const response=await callYouTube(`playlistItems?${params}`,ctx.accessToken);
  return playlistMembershipPresent(response,videoId);
}
/**
 * Attempt-owned idempotent assignment. If a POST becomes uncertain, never repeat
 * it automatically: a subsequent run can only prove existence with GET.
 */
export async function attachSelectedPlaylists(versionId,{attemptId=null}={}) {
  const ctx=await getPlaylistContext(versionId);
  const attempts=ctx.db.collection('publish_attempts');
  const parsedAttemptId=attemptId ? toObjectId(attemptId) : null;
  if(attemptId && !parsedAttemptId) throw new TypeError('Invalid YouTube upload attempt.');
  const attempt=await attempts.findOne({
    ...(parsedAttemptId?{_id:parsedAttemptId}:{}),
    platformVersionId:ctx.version._id,clientId:ctx.version.clientId,
    socialConnectionId:ctx.connection._id,platform:'youtube',
    providerVideoId:{$type:'string',$regex:'^[A-Za-z0-9_-]{11}$'},
  },{sort:{createdAt:-1}});
  if(!attempt || !validVideoId(attempt.providerVideoId))
    throw new TypeError('YouTube video has not finished uploading; playlist assignment is unavailable.');
  // During publishing, freeze playlist choices at submission.
  // For a completed video, later saved additions apply without reuploading.
  const samePublishedVideo = String(ctx.version.providerPostId || '') === String(attempt.providerVideoId);
  const ids=normalizePlaylistIds(samePublishedVideo ? (ctx.version.playlistIds || []) : (attempt.playlistIds || []));
  if(!ids.length)return {status:'none',assignments:[],videoId:attempt.providerVideoId};
  if(!ctx.canManage)return {status:'needs_reconnect',assignments:[],videoId:attempt.providerVideoId};
  const ownedIds=new Set((await listYouTubePlaylists(ctx)).map(x=>x.id));
  const results=[];
  for(const playlistId of ids) {
    if(!ownedIds.has(playlistId)) {
      results.push({playlistId,status:'needs_review',message:'Playlist no longer belongs to this channel.'});continue;
    }
    const field=playlistAssignmentKey(playlistId);
    const old=(await attempts.findOne({_id:attempt._id},{projection:{playlistAssignments:1}}))?.playlistAssignments?.[playlistId];
    if(old?.status==='added') {results.push({playlistId,status:'added'});continue;}
    let exists;
    try {exists=await membership(ctx,playlistId,attempt.providerVideoId);} catch {
      results.push({playlistId,status:'needs_review',message:'Could not confirm playlist membership.'});continue;
    }
    if(exists) {
      await attempts.updateOne({_id:attempt._id},{ $set:{[field]:{status:'added',verifiedAt:new Date()}} });
      results.push({playlistId,status:'added'});continue;
    }
    if(old) {
      results.push({playlistId,status:'needs_review',message:'Earlier playlist submission was uncertain; do not retry automatically.'});continue;
    }
    const claim=await attempts.updateOne({_id:attempt._id,[field]:{$exists:false}},
      {$set:{[field]:{status:'submitting',startedAt:new Date()}}});
    if(!claim.modifiedCount) {results.push({playlistId,status:'needs_review',message:'Playlist update already in progress.'});continue;}
    try {
      await callYouTube('playlistItems?part=snippet',ctx.accessToken,{method:'POST',body:{
        snippet:{playlistId,resourceId:{kind:'youtube#video',videoId:attempt.providerVideoId}},
      }});
      await attempts.updateOne({_id:attempt._id},{$set:{[field]:{status:'added',verifiedAt:new Date()}}});
      results.push({playlistId,status:'added'});
    }catch{
      await attempts.updateOne({_id:attempt._id},{$set:{[field]:{status:'needs_review',checkedAt:new Date()}}});
      results.push({playlistId,status:'needs_review',message:'Playlist update was not confirmed. Inspect before retrying.'});
    }
  }
  const status=results.every(x=>x.status==='added')?'added':'needs_review';
  await attempts.updateOne({_id:attempt._id},{$set:{playlistAssignmentStatus:status,playlistAssignmentDetails:results}});
  return {status,assignments:results,videoId:attempt.providerVideoId};
}
