import assert from "node:assert/strict";
import test from "node:test";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
const path = new URL("../app/api/platform-versions/[id]/publish/route.js", import.meta.url);
class Conflict extends Error {}
class ProviderError extends Error {}
async function route({ unauthorized = false, publishError } = {}) {
  const calls = [];
  const api = await loadWithStubs(path, {
    GoogleBusinessPublishConflictError: Conflict, GoogleBusinessPublishProviderError: ProviderError,
    PublishConflictError: class extends Error {}, PublishProviderError: class extends Error {},
    InstagramPublishConflictError: class extends Error {}, InstagramPublishProviderError: class extends Error {},
    LinkedInPublishConflictError: class extends Error {}, LinkedInPublishProviderError: class extends Error {},
    YouTubePublishConflictError: class extends Error {}, YouTubePublishProviderError: class extends Error {},
    requireApiSession: async () => unauthorized ? Response.json({ error: "Unauthorized" }, { status: 401 }) : null,
    toObjectId: value => value,
    getDb: async () => ({ collection: () => ({ findOne: async () => ({ platform: "google_business_profile" }) }) }),
    readJson: request => request.json(),
    publishGoogleBusinessVersion: async (id, revision) => {
      calls.push({ id, revision }); if (publishError) throw publishError;
      return { platformVersion: { _id: id }, attempt: { status: "processing" } };
    },
    refreshGoogleBusinessPostStatus: async id => { calls.push({ refresh: id }); return { attempt: { status: "succeeded" } }; },
    apiError: () => { throw new Error("Unexpected fallback"); },
  });
  return { api, calls };
}
const params = { params: Promise.resolve({ id: "version" }) };
const request = () => new Request("https://fixture/api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: 7 }) });
test("Google publish route requires owner session and forwards confirmed revision; GET only refreshes", async () => {
  const denied = await route({ unauthorized: true });
  assert.equal((await denied.api.POST(request(), params)).status, 401);
  assert.deepEqual(denied.calls, []);
  const allowed = await route();
  assert.equal((await allowed.api.POST(request(), params)).status, 200);
  assert.deepEqual(allowed.calls, [{ id: "version", revision: 7 }]);
  await allowed.api.GET(new Request("https://fixture/api/publish"), params);
  assert.deepEqual(allowed.calls[1], { refresh: "version" });
});
test("Google conflict, provider and invalid draft errors retain expected API status", async () => {
  for (const [publishError, status] of [[new Conflict("duplicate"), 409], [new ProviderError("denied"), 502], [new TypeError("invalid"), 400]]) {
    const f = await route({ publishError });
    const response = await f.api.POST(request(), params);
    assert.equal(response.status, status);
  }
});
