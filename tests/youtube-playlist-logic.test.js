import test from 'node:test';
import assert from 'node:assert/strict';
import {
 YOUTUBE_PLAYLIST_WRITE_SCOPE, validPlaylistId, validVideoId, normalizePlaylistIds,
 hasPlaylistWritePermission, validatePlaylistName, validatePlaylistVisibility,
 playlistListItems, playlistMembershipPresent, playlistAssignmentKey,
} from '../lib/youtube-playlist-logic.js';

test('validates and deduplicates draft playlist selection', () => {
 assert.deepEqual(normalizePlaylistIds(['PLaaaaaaaaaaaa','PLaaaaaaaaaaaa','PLbbbbbbbbbbbb']),['PLaaaaaaaaaaaa','PLbbbbbbbbbbbb']);
 assert.throws(()=>normalizePlaylistIds(['../../passwd']));
 assert.throws(()=>normalizePlaylistIds('PLaaaaaaaaaaaa'));
 assert.throws(()=>normalizePlaylistIds(Array.from({length:26},(_,i)=>`PLabcdefghij${i}xx`)));
 assert.equal(validPlaylistId('PLaaaaaaaaaaaa'),true);
 assert.equal(validVideoId('abcdefghijk'),true);
 assert.equal(playlistAssignmentKey('PLaaaaaaaaaaaa'),'playlistAssignments.PLaaaaaaaaaaaa');
});
test('requires optional new OAuth scope without broadening base upload permission',()=>{
 assert.equal(hasPlaylistWritePermission(['https://www.googleapis.com/auth/youtube.upload']),false);
 assert.equal(hasPlaylistWritePermission([YOUTUBE_PLAYLIST_WRITE_SCOPE]),true);
 assert.equal(validatePlaylistVisibility('private'),'private');
 assert.throws(()=>validatePlaylistVisibility('everyone'));
 assert.equal(validatePlaylistName(' New playlist '),'New playlist');
 assert.throws(()=>validatePlaylistName(' '));
});
test('filters playlist listing to selected channel and checks membership',()=>{
 const playlists={items:[
  {id:'PLaaaaaaaaaaaa',snippet:{title:'Mine',channelId:'UCfoo'},status:{privacyStatus:'private'}},
  {id:'PLbbbbbbbbbbbb',snippet:{title:'Other',channelId:'UCbar'}}]};
 assert.deepEqual(playlistListItems(playlists,'UCfoo'),[{id:'PLaaaaaaaaaaaa',title:'Mine',privacyStatus:'private'}]);
 assert.equal(playlistMembershipPresent({items:[{snippet:{resourceId:{kind:'youtube#video',videoId:'abcdefghijk'}}}]},'abcdefghijk'),true);
 assert.equal(playlistMembershipPresent({items:[]},'abcdefghijk'),false);
});
