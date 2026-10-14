import "server-only";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import { refreshSocialConnectionHealth } from "@/lib/connections";
import { decryptSecret } from "@/lib/secure-values";
import { readMediaObject } from "@/lib/s3";
import { createLinkedInPost, uploadLinkedInImage, uploadLinkedInRestImage, uploadLinkedInRestVideo, waitForLinkedInVideo, createLinkedInRestMediaPost } from "@/lib/linkedin-publisher";
import { linkedinSubmissionKey, validateLinkedInPublishDraft, linkedinErrorDetails, isLinkedInDefinitiveFailure } from "@/lib/linkedin-publish-logic";

export class LinkedInPublishConflictError extends Error {
  constructor(message,attempt=null){super(message);this.name="LinkedInPublishConflictError";this.attempt=attempt;}
}
export class LinkedInPublishProviderError extends Error {
  constructor(message,attempt=null){super(message);this.name="LinkedInPublishProviderError";this.attempt=attempt;}
}
async function context(id) {
  const versionId=toObjectId(id);
  if(!versionId) throw new TypeError("LinkedIn version not found.");
  const db=await getDb();
  const versions=db.collection("platform_versions");
  const attempts=db.collection("publish_attempts");
  await attempts.createIndex({submissionKey:1},{unique:true,sparse:true});
  const version=await versions.findOne({_id:versionId,platform:"linkedin",active:{$ne:false}});
  if(!version) throw new TypeError("LinkedIn version is unavailable.");
  const [master,connection]=await Promise.all([
    db.collection("master_content").findOne({_id:version.masterContentId}),
    db.collection("social_connections").findOne({_id:version.socialConnectionId}),
  ]);
  if(!master || !connection || String(master.clientId)!==String(version.clientId) ||
      String(connection.clientId)!==String(version.clientId) || connection.platform!=="linkedin" ||
      connection.providerAccountId!==version.providerAccountId)
    throw new TypeError("LinkedIn destination no longer belongs to this client.");
  const ids=Array.isArray(version.mediaIds)?version.mediaIds:[];
  const media=ids.length?await db.collection("media_assets").find({
    _id:{$in:ids},clientId:version.clientId,status:"uploaded"
  }).toArray():[];
  const byId=new Map(media.map(a=>[String(a._id),a]));
  return {version,master,connection,versions,attempts,images:ids.map(x=>byId.get(String(x))).filter(Boolean)};
}
export async function publishLinkedInVersion(id) {
  const {version,master,connection,versions,attempts,images}=await context(id);
  await refreshSocialConnectionHealth(String(connection._id));
  const db=await getDb();
  const current=await db.collection("social_connections").findOne({
    _id:connection._id,clientId:version.clientId,platform:"linkedin",
    providerAccountId:connection.providerAccountId,
  });
  if(!current) throw new TypeError("LinkedIn connection changed during validation.");
  const validation=validateLinkedInPublishDraft({
    message:version.message,destinationUrl:version.destinationUrl,
    mediaIds:(version.mediaIds||[]).map(String),
    mediaAssets:images.map(a=>({_id:String(a._id),contentType:a.contentType,size:a.size})),
    healthStatus:current.healthStatus,canPublish:current.capabilities?.canPublish===true,
    masterChanged:Number(version.masterRevisionSynced||0)!==Number(master.revision||0),
    customized:version.customized===true,
  });
  if(!validation.publishable) throw new TypeError(validation.blocking.join(" "));
  const key=linkedinSubmissionKey(String(version._id),Number(version.revision||1));
  const now=new Date();
  let attemptId;
  try {
    attemptId=(await attempts.insertOne({
      submissionKey:key,platform:"linkedin",platformVersionId:version._id,
      masterContentId:version.masterContentId,clientId:version.clientId,
      socialConnectionId:version.socialConnectionId,
      masterRevision:Number(master.revision||1),
      platformVersionRevision:Number(version.revision||1),
      publishMode:validation.publishMode,mediaAssetIds:version.mediaIds||[],
      status:"submitting",providerPostId:"",providerPostUrl:"",
      providerMedia:[],providerError:null,startedAt:now,createdAt:now,updatedAt:now,completedAt:null,
    })).insertedId;
  } catch(error) {
    if(error?.code!==11000) throw error;
    const prior=await attempts.findOne({submissionKey:key});
    throw new LinkedInPublishConflictError(
      prior?.status==="succeeded"?"This LinkedIn revision has already been published.":
      "This LinkedIn revision is already submitting or needs review.",serializeDocument(prior));
  }
  let createStarted=false;
  let imageUrn="";
  const mediaUrns=[];
  let result;
  try {
    const token=decryptSecret(current.tokenEncrypted);
    for(const asset of images){
      const object=await readMediaObject(asset.objectKey);
      const urn=validation.publishMode==="video"
        ? await uploadLinkedInRestVideo({accessToken:token,memberId:current.providerAccountId,bytes:object.bytes})
        : validation.publishMode==="multi_image"
        ? await uploadLinkedInRestImage({accessToken:token,memberId:current.providerAccountId,bytes:object.bytes})
        : await uploadLinkedInImage({accessToken:token,memberId:current.providerAccountId,bytes:object.bytes,contentType:asset.contentType||object.contentType});
      mediaUrns.push(urn);
      await attempts.updateOne({_id:attemptId},{$push:{
        providerMedia:{mediaAssetId:asset._id,providerMediaId:urn,uploadedAt:new Date()},
      },$set:{updatedAt:new Date()}});
    }
    imageUrn=mediaUrns[0] || "";
    if (validation.publishMode === "video") {
      await waitForLinkedInVideo({ accessToken: token, memberId: current.providerAccountId, videoUrn: imageUrn });
    }
    createStarted=true;
    result=["video","multi_image"].includes(validation.publishMode)
      ? await createLinkedInRestMediaPost({
          accessToken:token,memberId:current.providerAccountId,version,mediaUrns,
          mode:validation.publishMode,
        })
      : await createLinkedInPost({accessToken:token,memberId:current.providerAccountId,version,imageUrn});
  } catch(error){
    const failed=!createStarted || isLinkedInDefinitiveFailure(error);
    const status=failed?"failed":"unknown";
    const providerError = {
      ...linkedinErrorDetails(error),
      ...(!createStarted && error?.name === "LinkedInVideoReadinessError"
        ? { message: error.message } : {}),
      // Upload failures happen before the public create-post request. Safe
      // transient failures can be retried with the same revision key.
      // After create-post starts, timeout/rate-limit outcomes remain unknown.
      isTransient: !createStarted && (
        [408, 429, 500, 502, 503, 504].includes(Number(error?.status)) ||
        ["AbortError", "TimeoutError"].includes(String(error?.name || ""))
      ),
    };
    const completedAt=new Date();
    const update={$set:{status,providerError,completedAt,updatedAt:completedAt}};
    if(failed) update.$unset={submissionKey:""};
    await attempts.updateOne({_id:attemptId},update);
    await versions.updateOne({_id:version._id},{$set:{
      lastPublishAttemptId:attemptId,lastPublishStatus:status,lastPublishError:providerError,updatedAt:completedAt,
    }});
    throw new LinkedInPublishProviderError(!createStarted && error?.name === "LinkedInVideoReadinessError" ? error.message : failed?
      "LinkedIn rejected the request before a post was submitted. Retry is available.":
      "LinkedIn may have accepted this post. Review its result before attempting another publish.",
      serializeDocument(await attempts.findOne({_id:attemptId})));
  }
  const completedAt=new Date();
  await attempts.updateOne({_id:attemptId},{$set:{
    status:"succeeded",providerPostId:result.providerPostId,providerPostUrl:result.providerPostUrl,
    providerError:null,completedAt,updatedAt:completedAt,
  }});
  const saved=await versions.findOneAndUpdate({_id:version._id,revision:version.revision},{$set:{
    status:"published",publishedAt:completedAt,publishedRevision:Number(version.revision||1),
    lastPublishAttemptId:attemptId,lastPublishStatus:"succeeded",lastPublishError:null,
    providerMediaIds:mediaUrns,providerPostId:result.providerPostId,
    providerPostUrl:result.providerPostUrl,updatedAt:completedAt,
  }},{returnDocument:"after"});
  if(!saved) throw new LinkedInPublishConflictError(
    "LinkedIn published the post but the saved version changed. Do not repost.",
    serializeDocument(await attempts.findOne({_id:attemptId})));
  return serializeDocument({platformVersion:saved,attempt:await attempts.findOne({_id:attemptId})});
}
