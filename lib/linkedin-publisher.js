import "server-only";
import { linkedinPostUrl, linkedInPostText } from "@/lib/linkedin-publish-logic";

const BASE = "https://api.linkedin.com/v2";
export class LinkedInPublishApiError extends Error {
  constructor(status) {super("LinkedIn publishing request failed."); this.name="LinkedInPublishApiError"; this.status=status;}
}
async function request(url, accessToken, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(url, {method, headers:{
    Authorization:`Bearer ${accessToken}`, "X-Restli-Protocol-Version":"2.0.0",
    ...headers,
  }, body, cache:"no-store", signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new LinkedInPublishApiError(response.status);
  return response;
}
export async function uploadLinkedInImage({accessToken, memberId, bytes, contentType}) {
  const response = await request(`${BASE}/assets?action=registerUpload`,accessToken,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({registerUploadRequest:{
      recipes:["urn:li:digitalmediaRecipe:feedshare-image"],
      owner:`urn:li:person:${memberId}`,
      serviceRelationships:[{relationshipType:"OWNER",identifier:"urn:li:userGeneratedContent"}],
    }}),
  });
  const data = await response.json();
  const upload = data?.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"];
  const asset = data?.value?.asset;
  if (!upload?.uploadUrl || !asset) throw new Error("LinkedIn image registration returned no upload target.");
  const uploaded = await fetch(upload.uploadUrl,{method:"PUT",headers:{
    ...upload.headers,"Content-Type":contentType,
  },body:bytes,signal:AbortSignal.timeout(30000)});
  if (!uploaded.ok) throw new LinkedInPublishApiError(uploaded.status);
  return asset;
}
export async function createLinkedInPost({accessToken,memberId,version,imageUrn=""}) {
  const text = linkedInPostText(version);
  const url = String(version.destinationUrl || "").trim();
  const shareContent = imageUrn
    ? {shareCommentary:{text},shareMediaCategory:"IMAGE",
        media:[{status:"READY",media:imageUrn}]}
    : url
      ? {shareCommentary:{text:String(version.message || "").trim()},
          shareMediaCategory:"ARTICLE",media:[{status:"READY",originalUrl:url}]}
      : {shareCommentary:{text},shareMediaCategory:"NONE"};
  const response = await request(`${BASE}/ugcPosts`,accessToken,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({author:`urn:li:person:${memberId}`,lifecycleState:"PUBLISHED",
      specificContent:{"com.linkedin.ugc.ShareContent":shareContent},
      visibility:{"com.linkedin.ugc.MemberNetworkVisibility":"PUBLIC"}}),
  });
  const urn = response.headers.get("x-restli-id") || (await response.json().catch(()=>null))?.id;
  if (!urn) throw new Error("LinkedIn accepted the post but did not provide a post ID.");
  return {providerPostId:urn,providerPostUrl:linkedinPostUrl(urn)};
}
