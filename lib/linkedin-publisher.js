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


// Versioned LinkedIn REST APIs for multi-image and video posts.
// The existing proven UGC text/link/single-image path remains unchanged.
const REST = "https://api.linkedin.com/rest";
const versionHeader = () => process.env.LINKEDIN_REST_VERSION || "202609";
async function restRequest(path, token, options = {}) {
  return request(REST + path, token, {
    ...options,
    headers: {"Linkedin-Version":versionHeader(), ...options.headers},
  });
}
export async function uploadLinkedInRestImage({accessToken,memberId,bytes}) {
  const initialized = await restRequest("/images?action=initializeUpload",accessToken,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({initializeUploadRequest:{owner:"urn:li:person:"+memberId}}),
  });
  const data=(await initialized.json()).value;
  if(!data?.image || !data?.uploadUrl) throw new Error("LinkedIn did not provide an image upload destination.");
  const uploaded=await fetch(data.uploadUrl,{method:"PUT",body:bytes,
    headers:{"Content-Type":"application/octet-stream"},signal:AbortSignal.timeout(60000)});
  if(!uploaded.ok) throw new LinkedInPublishApiError(uploaded.status);
  return data.image;
}
export async function uploadLinkedInRestVideo({accessToken,memberId,bytes}) {
  const buffer=Buffer.from(bytes);
  const initialized=await restRequest("/videos?action=initializeUpload",accessToken,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({initializeUploadRequest:{
      owner:"urn:li:person:"+memberId,fileSizeBytes:buffer.length,
      uploadCaptions:false,uploadThumbnail:false,
    }}),
  });
  const data=(await initialized.json()).value;
  if(!data?.video || !data.uploadInstructions?.length)
    throw new Error("LinkedIn did not provide video upload instructions.");
  const uploadedPartIds=[];
  for(const part of data.uploadInstructions){
    const from=Number(part.firstByte),to=Number(part.lastByte);
    if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||to<from||to>=buffer.length)
      throw new Error("LinkedIn returned invalid video part offsets.");
    const uploaded=await fetch(part.uploadUrl,{method:"PUT",body:buffer.subarray(from,to+1),
      headers:{"Content-Type":"application/octet-stream"},signal:AbortSignal.timeout(120000)});
    if(!uploaded.ok) throw new LinkedInPublishApiError(uploaded.status);
    const etag=uploaded.headers.get("etag");
    if(!etag) throw new Error("LinkedIn video part upload returned no ETag.");
    uploadedPartIds.push(etag.replace(/^"|"$/g,""));
  }
  await restRequest("/videos?action=finalizeUpload",accessToken,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({finalizeUploadRequest:{
      video:data.video,uploadToken:data.uploadToken || "",uploadedPartIds,
    }}),
  });
  return data.video;
}
export async function createLinkedInRestMediaPost({accessToken,memberId,version,mediaUrns,mode}) {
  const content=mode==="video" ? {media:{id:mediaUrns[0]}} :
    {multiImage:{images:mediaUrns.map((id)=>({id}))}};
  const response=await restRequest("/posts",accessToken,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({author:"urn:li:person:"+memberId,
      commentary:linkedInPostText(version),visibility:"PUBLIC",
      distribution:{feedDistribution:"MAIN_FEED",targetEntities:[],thirdPartyDistributionChannels:[]},
      lifecycleState:"PUBLISHED",isReshareDisabledByAuthor:false,content,
    }),
  });
  const urn=response.headers.get("x-restli-id") || (await response.json().catch(()=>null))?.id;
  if(!urn) throw new Error("LinkedIn accepted the post but did not return its ID.");
  return {providerPostId:urn,providerPostUrl:linkedinPostUrl(urn)};
}
