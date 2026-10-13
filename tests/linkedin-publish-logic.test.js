import test from "node:test";
import assert from "node:assert/strict";
import {
  linkedInPostText, linkedinSubmissionKey, linkedinPostUrl,
  validateLinkedInPublishDraft, isLinkedInDefinitiveFailure,
} from "../lib/linkedin-publish-logic.js";

test("LinkedIn text adds the link once", () => {
  assert.equal(linkedInPostText({message:"Hello",destinationUrl:"https://example.com"}),"Hello\n\nhttps://example.com");
  assert.equal(linkedInPostText({message:"See https://example.com",destinationUrl:"https://example.com"}),"See https://example.com");
});
test("submission key binds one revision", () => {
  assert.equal(linkedinSubmissionKey("abc",2),"linkedin:abc:revision:2");
  assert.throws(()=>linkedinSubmissionKey("",1),TypeError);
});
test("LinkedIn post URLs use the returned provider URN", () => {
  assert.equal(linkedinPostUrl("urn:li:ugcPost:1234"),"https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A1234/");
  assert.equal(linkedinPostUrl("wrong"),"");
});
test("single-image and health validation", () => {
  const input={message:"Hi",mediaIds:["a"],mediaAssets:[{_id:"a",contentType:"image/png",size:2000}],healthStatus:"healthy",canPublish:true};
  assert.equal(validateLinkedInPublishDraft(input).publishable,true);
  assert.equal(validateLinkedInPublishDraft({...input,mediaIds:["a","b"]}).publishable,false);
  assert.equal(validateLinkedInPublishDraft({...input,healthStatus:"expired"}).publishable,false);
  assert.equal(validateLinkedInPublishDraft({...input,mediaAssets:[{_id:"a",contentType:"video/mp4",size:2000}]}).publishMode,"video");
});
test("only definitive provider rejections permit resubmission", () => {
  assert.equal(isLinkedInDefinitiveFailure({name:"LinkedInPublishApiError",status:403}),true);
  assert.equal(isLinkedInDefinitiveFailure({name:"LinkedInPublishApiError",status:502}),false);
  assert.equal(isLinkedInDefinitiveFailure(new Error("timeout")),false);
});

test("LinkedIn media publish modes and safety limits", () => {
  const asset=(id)=>({_id:id,contentType:"image/jpeg",size:1000});
  const one={message:"Images",healthStatus:"healthy",canPublish:true,
    mediaIds:["a","b"],mediaAssets:[asset("a"),asset("b")]};
  assert.equal(validateLinkedInPublishDraft(one).publishMode,"multi_image");
  assert.equal(validateLinkedInPublishDraft(one).publishable,true);
  assert.equal(validateLinkedInPublishDraft({...one,mediaIds:["a","b","c"]}).publishable,false);
  const video={message:"Video",healthStatus:"healthy",canPublish:true,
    mediaIds:["v"],mediaAssets:[{_id:"v",contentType:"video/mp4",size:4096}]};
  assert.equal(validateLinkedInPublishDraft(video).publishMode,"video");
  assert.equal(validateLinkedInPublishDraft(video).publishable,true);
  assert.equal(validateLinkedInPublishDraft({...video,mediaIds:["v","a"],
    mediaAssets:[video.mediaAssets[0],asset("a")]}).publishable,false);
  assert.equal(validateLinkedInPublishDraft({...video,mediaAssets:[{...video.mediaAssets[0],
    size:501*1024*1024}]}).publishable,false);
});
