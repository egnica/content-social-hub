import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "mongodb";
import * as existingLogic from "../lib/platform-version-logic.js";
import * as googleLogic from "../lib/google-business-post-logic.js";
import { loadWithStubs } from "./helpers/load-with-stubs.js";
import { readFile } from "node:fs/promises";

function makeFixture() {
  const clientId = new ObjectId(), otherClientId = new ObjectId();
  const masterId = new ObjectId(), connectionId = new ObjectId();
  const imageId = new ObjectId(), otherImageId = new ObjectId();
  const records = {
    master_content: [{
      _id: masterId, clientId, text: "Original Google update", primaryUrl: "https://example.org",
      mediaIds: [imageId], defaultPrimaryMediaId: imageId, revision: 4,
    }],
    social_connections: [{
      _id: connectionId, clientId, platform: "google_business_profile",
      providerAccountId: "accounts/44/locations/55", accountName: "Exact business location",
      healthStatus: "healthy", capabilities: { canPublish: false },
    }],
    media_assets: [{
      _id: imageId, clientId, status: "uploaded", contentType: "image/png",
      size: 100000, width: 720, height: 720,
    }, {
      _id: otherImageId, clientId: otherClientId, status: "uploaded",
      contentType: "image/png", size: 100000, width: 720, height: 720,
    }],
    platform_versions: [],
  };
  const eq = (a, b) => String(a) === String(b);
  const matches = (doc, filter) => Object.entries(filter).every(([field, value]) => {
    const actual = doc[field];
    if (value && typeof value === "object" && !(value instanceof ObjectId) && !(value instanceof Date)) {
      if ("$ne" in value) return !eq(actual, value.$ne);
      if ("$in" in value) return value.$in.some((v) => eq(actual, v));
    }
    return eq(actual, value);
  });
  const db = {
    collection(name) {
      const docs = (records[name] ||= []);
      return {
        createIndex: async () => "index",
        findOne: async (filter) => docs.find((doc) => matches(doc, filter)) || null,
        find(filter) {
          let result = docs.filter((doc) => matches(doc, filter));
          return {
            project() { return this; },
            sort() { return this; },
            async toArray() { return result; },
          };
        },
        async updateOne(filter, update, opts = {}) {
          let doc = docs.find((d) => matches(d, filter));
          if (!doc && opts.upsert) {
            doc = { _id: new ObjectId(), ...update.$setOnInsert };
            docs.push(doc);
          }
          if (doc) Object.assign(doc, update.$set || {});
          return { matchedCount: doc ? 1 : 0 };
        },
        async updateMany(filter, update) {
          let matchedCount = 0;
          for (const doc of docs.filter((d) => matches(d, filter))) {
            Object.assign(doc, update.$set || {}); matchedCount += 1;
          }
          return { matchedCount };
        },
        async findOneAndUpdate(filter, update) {
          const doc = docs.find((d) => matches(d, filter));
          if (!doc) return null;
          Object.assign(doc, update.$set || {});
          for (const [field, amount] of Object.entries(update.$inc || {})) {
            doc[field] = Number(doc[field] || 0) + amount;
          }
          return doc;
        },
      };
    },
  };
  return { records, db, clientId, otherClientId, masterId, connectionId, imageId, otherImageId };
}
async function platformApi(fixture) {
  return loadWithStubs(new URL("../lib/platform-versions.js", import.meta.url), {
    ObjectId, getDb: async () => fixture.db,
    toObjectId: (id) => ObjectId.isValid(id) ? new ObjectId(id) : null,
    serializeDocument: (doc) => JSON.parse(JSON.stringify(doc)),
    ...existingLogic, ...googleLogic,
  });
}

test("Google Healthy non-publishable location can be selected into isolated STANDARD draft", async () => {
  const f = makeFixture();
  const api = await platformApi(f);
  const state = await api.getPlatformDestinationState(f.masterId.toString());
  assert.equal(state.destinations.length, 1);
  assert.equal(state.destinations[0].selectable, true);
  assert.equal(state.destinations[0].canPublish, false);
  const synced = await api.syncPlatformVersionSelection(
    f.masterId.toString(), [f.connectionId.toString()]);
  assert.equal(synced.platformVersions.length, 1);
  const version = synced.platformVersions[0];
  assert.equal(version.platform, "google_business_profile");
  assert.equal(version.providerAccountId, "accounts/44/locations/55");
  assert.equal(version.summary, "Original Google update");
  assert.equal(version.ctaType, "LEARN_MORE");
  assert.equal(version.mediaIds[0], f.imageId.toString());
  assert.equal(version.revision, 1);
  assert.equal(version.customized, false);
  assert.equal(version.masterRevisionSynced, 4);
});

test("Google draft saves and resets independently with revision increments; never publishes", async () => {
  const f = makeFixture();
  const api = await platformApi(f);
  const selected = await api.syncPlatformVersionSelection(f.masterId.toString(), [f.connectionId.toString()]);
  const id = selected.platformVersions[0]._id;
  const saved = await api.saveGoogleBusinessPlatformVersion(id, {
    summary: "Different text for Google", ctaType: "CALL", ctaUrl: "",
    mediaIds: [], releaseSource: "destination_override", destinationLocalDateTime: "2026-11-20T11:30",
  });
  assert.equal(saved.summary, "Different text for Google");
  assert.equal(saved.revision, 2);
  assert.equal(saved.masterRevisionSynced, 4);
  assert.equal(saved.customized, true);
  assert.equal(saved.destinationLocalDateTime, "2026-11-20T11:30");
  assert.equal(saved.status, "draft");
  assert.equal(saved.publishedRevision, undefined);
  assert.equal(f.records.platform_versions.length, 1);
  f.records.master_content[0].text = "Master revised";
  f.records.master_content[0].revision = 5;
  const reset = await api.resetGoogleBusinessPlatformVersionFromMaster(id);
  assert.equal(reset.summary, "Master revised");
  assert.equal(reset.revision, 3);
  assert.equal(reset.customized, false);
  assert.equal(reset.masterRevisionSynced, 5);
  assert.equal(reset.releaseSource, "master");
});

test("rejects cross-client media, unlinked destinations, and renamed location identity", async () => {
  const f = makeFixture();
  const api = await platformApi(f);
  const state = await api.syncPlatformVersionSelection(f.masterId.toString(), [f.connectionId.toString()]);
  const id = state.platformVersions[0]._id;
  await assert.rejects(api.saveGoogleBusinessPlatformVersion(id, {
    summary: "Hello", mediaIds: [f.otherImageId.toString()],
  }), /attached, uploaded and owned/);
  await assert.rejects(api.saveGoogleBusinessPlatformVersion(id, {
    summary: "Hello", ctaType: "SIGN_UP", ctaUrl: "bad", mediaIds: [],
  }), /valid http/);
  f.records.social_connections[0].providerAccountId = "accounts/44/locations/another";
  await assert.rejects(api.saveGoogleBusinessPlatformVersion(id, {
    summary: "Hello", mediaIds: [],
  }), /no longer connected/);
});

test("Google scheduling remains blocked while publisher requires an exact confirmed revision", async () => {
  const scheduling = await readFile(new URL("../lib/scheduling.js", import.meta.url), "utf8");
  const publishRoute = await readFile(new URL("../app/api/platform-versions/[id]/publish/route.js", import.meta.url), "utf8");
  assert.match(scheduling, /platform: \{ \$in: \["facebook", "instagram", "linkedin", "youtube"\] \}/);
  assert.match(publishRoute, /target\?\.platform === "google_business_profile"/);
  assert.match(publishRoute, /publishGoogleBusinessVersion\(id, body\?\.revision\)/);
});


test("Google recorded submissions cannot be edited or reset, including a claim racing a save", async () => {
  const f = makeFixture();
  const api = await platformApi(f);
  const selected = await api.syncPlatformVersionSelection(f.masterId.toString(), [f.connectionId.toString()]);
  const id = selected.platformVersions[0]._id;
  f.records.platform_versions[0].googlePublishLock = true;
  await assert.rejects(api.saveGoogleBusinessPlatformVersion(id, { summary: "changed", mediaIds: [] }), /read-only/);
  await assert.rejects(api.resetGoogleBusinessPlatformVersionFromMaster(id), /read-only/);
  f.records.platform_versions[0].googlePublishLock = false;
  const collection = f.db.collection.bind(f.db);
  f.db.collection = name => {
    const value = collection(name);
    if (name === "platform_versions") {
      const update = value.findOneAndUpdate;
      value.findOneAndUpdate = async (...args) => {
        f.records.platform_versions[0].googlePublishLock = true;
        return update(...args);
      };
    }
    return value;
  };
  await assert.rejects(api.saveGoogleBusinessPlatformVersion(id, { summary: "race", mediaIds: [] }), /changed before saving/);
  assert.equal(f.records.platform_versions[0].summary, "Original Google update");
});
