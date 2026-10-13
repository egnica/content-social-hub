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
  assert.equal(validateLinkedInPublishDraft({...input,mediaAssets:[{_id:"a",contentType:"video/mp4",size:2000}]}).publishable,false);
});
test("only definitive provider rejections permit resubmission", () => {
  assert.equal(isLinkedInDefinitiveFailure({name:"LinkedInPublishApiError",status:403}),true);
  assert.equal(isLinkedInDefinitiveFailure({name:"LinkedInPublishApiError",status:502}),false);
  assert.equal(isLinkedInDefinitiveFailure(new Error("timeout")),false);
});
