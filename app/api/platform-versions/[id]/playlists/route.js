import { requireApiSession } from '@/lib/session';
import { apiError, readJson } from '@/lib/api';
import {
  getYouTubePlaylistChoices, createYouTubePlaylist,
  attachSelectedPlaylists, YouTubePlaylistError,
} from '@/lib/youtube-playlists';
export const dynamic = 'force-dynamic';
function failure(error) {
  if(error instanceof TypeError)return Response.json({error:error.message},{status:400});
  if(error instanceof YouTubePlaylistError)return Response.json({error:error.message},{status:error.status>=400&&error.status<600?error.status:502});
  return apiError(error,'YouTube playlist request failed.');
}
export async function GET(_request,{params}) {
  const unauthorized=await requireApiSession();if(unauthorized)return unauthorized;
  try {
    const {id}=await params;
    return Response.json(await getYouTubePlaylistChoices(id),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error);}
}
export async function POST(request,{params}) {
  const unauthorized=await requireApiSession();if(unauthorized)return unauthorized;
  try {
    const {id}=await params;
    const input=await readJson(request);
    if(input?.action==='create') {
      return Response.json({playlist:await createYouTubePlaylist(id,{
        title:input.title,privacyStatus:input.privacyStatus,
      })},{status:201});
    }
    if(input?.action==='attach') {
      return Response.json(await attachSelectedPlaylists(id));
    }
    throw new TypeError('Unknown YouTube playlist action.');
  }catch(error){return failure(error);}
}
