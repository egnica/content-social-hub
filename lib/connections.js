import "server-only";

import { ObjectId } from "mongodb";
import {
  createRequestedPlatformStatus,
  isConnectionRequestUsableForPlatform,
  markConnectionRequestPlatformConnected,
  normalizeConnectionRequestPlatforms,
} from "@/lib/connection-request-logic";
import {
  checkFacebookPage,
  getFacebookRequiredPermissions,
  inspectFacebookToken,
} from "@/lib/facebook";
import {
  getInstagramProfile,
  refreshInstagramAccessToken,
} from "@/lib/instagram";
import {
  buildInstagramConnectionIdentity,
  getInstagramHealth,
} from "@/lib/instagram-connection-logic";
import { getLinkedInProfile, inspectLinkedInToken } from "@/lib/linkedin";
import { getLinkedInHealth } from "@/lib/linkedin-connection-logic";
import { getAuthorizedYouTubeChannel, refreshYouTubeToken } from "@/lib/youtube";
import { assertSameYouTubeChannel, getYouTubeHealth } from "@/lib/youtube-connection-logic";
import { refreshGoogleBusinessToken, verifyGoogleBusinessLocation, GoogleBusinessApiError } from "@/lib/google-business";
import { GOOGLE_BUSINESS_PLATFORM, GOOGLE_BUSINESS_SCOPE, getGoogleBusinessHealth,
  assertSameGoogleBusinessLocation } from "@/lib/google-business-connection-logic";
import { requireEnv } from "@/lib/env";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import {
  createSecureToken,
  decryptSecret,
  encryptSecret,
  hashSecureToken,
} from "@/lib/secure-values";

import { renewInstagramConnection } from "@/lib/instagram-token-maintenance";

const REQUEST_DURATION_MS = 48 * 60 * 60 * 1000;
const OAUTH_STATE_DURATION_MS = 10 * 60 * 1000;
const SELECTION_DURATION_MS = 20 * 60 * 1000;

function removeEncryptedToken(document) {
  const safeDocument = { ...document };
  delete safeDocument.tokenEncrypted;
  delete safeDocument.refreshTokenEncrypted;
  return safeDocument;
}

let connectionIndexesPromise;

async function connectionCollections() {
  const db = await getDb();

  if (!connectionIndexesPromise) {
    connectionIndexesPromise = Promise.all([
      db.collection("social_connections").createIndex(
        { clientId: 1, platform: 1, providerAccountId: 1 },
        { unique: true },
      ),
      db.collection("social_connections").createIndex({
        healthStatus: 1,
        updatedAt: -1,
      }),
      db.collection("connection_requests").createIndex(
        { tokenHash: 1 },
        { unique: true },
      ),
      db.collection("connection_requests").createIndex({
        clientId: 1,
        createdAt: -1,
      }),
      db.collection("oauth_states").createIndex(
        { stateHash: 1 },
        { unique: true },
      ),
      db.collection("oauth_states").createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 },
      ),
      db.collection("account_selection_flows").createIndex(
        { tokenHash: 1 },
        { unique: true },
      ),
      db.collection("account_selection_flows").createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0 },
      ),
      db.collection("email_log").createIndex({ createdAt: -1 }),
    ]).catch((error) => {
      connectionIndexesPromise = undefined;
      throw error;
    });
  }

  await connectionIndexesPromise;

  return {
    clients: db.collection("clients"),
    connections: db.collection("social_connections"),
    requests: db.collection("connection_requests"),
    oauthStates: db.collection("oauth_states"),
    selectionFlows: db.collection("account_selection_flows"),
    emailLog: db.collection("email_log"),
  };
}

export function getPhase2ConfigurationStatus() {
  const facebookRequired = [
    "META_APP_ID",
    "META_APP_SECRET",
    "APP_BASE_URL",
    "OAUTH_TOKEN_ENCRYPTION_KEY",
  ];
  const instagramRequired = [
    "INSTAGRAM_APP_ID",
    "INSTAGRAM_APP_SECRET",
    "APP_BASE_URL",
    "OAUTH_TOKEN_ENCRYPTION_KEY",
  ];
  const missingFacebook = facebookRequired.filter(
    (name) => !process.env[name]?.trim(),
  );
  const linkedinRequired = [
    "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET",
    "APP_BASE_URL", "OAUTH_TOKEN_ENCRYPTION_KEY",
  ];
  const missingLinkedin = linkedinRequired.filter((name) => !process.env[name]?.trim());
  const youtubeRequired = ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "APP_BASE_URL", "OAUTH_TOKEN_ENCRYPTION_KEY"];
  const missingYoutube = youtubeRequired.filter(name => !process.env[name]?.trim());
  const missingGoogleBusiness = ["GOOGLE_BUSINESS_CLIENT_ID", "GOOGLE_BUSINESS_CLIENT_SECRET",
    "APP_BASE_URL", "OAUTH_TOKEN_ENCRYPTION_KEY"].filter(name => !process.env[name]?.trim());
  const missingInstagram = instagramRequired.filter(
    (name) => !process.env[name]?.trim(),
  );
  const missingEmail = ["RESEND_API_KEY", "EMAIL_FROM"].filter(
    (name) => !process.env[name]?.trim(),
  );

  return {
    facebookReady: missingFacebook.length === 0,
    instagramReady: missingInstagram.length === 0,
    linkedinReady: missingLinkedin.length === 0,
    youtubeReady: missingYoutube.length === 0,
    googleBusinessReady: missingGoogleBusiness.length === 0,
    emailReady: missingEmail.length === 0,
    missingFacebook,
    missingInstagram,
    missingLinkedin,
    missingYoutube,
    missingGoogleBusiness,
    missingEmail,
  };
}

export async function listSocialConnections({ clientId = "" } = {}) {
  const { clients, connections } = await connectionCollections();
  const query = {};
  const clientObjectId = toObjectId(clientId);

  if (clientObjectId) {
    query.clientId = clientObjectId;
  }

  const [documents, clientDocuments] = await Promise.all([
    connections.find(query).sort({ accountName: 1 }).toArray(),
    clients.find({}).project({ name: 1 }).toArray(),
  ]);
  const clientNames = new Map(
    clientDocuments.map((client) => [client._id.toString(), client.name]),
  );

  return serializeDocument(
    documents.map((document) => ({
      ...removeEncryptedToken(document),
      clientName:
        clientNames.get(document.clientId?.toString()) || "Unknown client",
    })),
  );
}

export async function listConnectionRequests({ clientId = "" } = {}) {
  const { requests } = await connectionCollections();
  const clientObjectId = toObjectId(clientId);
  const query = clientObjectId ? { clientId: clientObjectId } : {};

  const documents = await requests
    .find(query, { projection: { tokenHash: 0 } })
    .sort({ createdAt: -1 })
    .limit(25)
    .toArray();

  const now = new Date();

  return serializeDocument(
    documents.map((document) => ({
      ...document,
      status:
        document.expiresAt <= now &&
        !["completed", "revoked"].includes(document.status)
          ? "expired"
          : document.status,
    })),
  );
}

export async function createConnectionRequest(
  clientId,
  requestedPlatformsInput = ["facebook"],
) {
  const clientObjectId = toObjectId(clientId);

  if (!clientObjectId) {
    throw new TypeError("Choose a valid client.");
  }

  const requestedPlatforms = normalizeConnectionRequestPlatforms(
    requestedPlatformsInput,
  );
  const { clients, requests } = await connectionCollections();
  const client = await clients.findOne({ _id: clientObjectId });

  if (!client) {
    throw new TypeError("Choose a valid client.");
  }

  if (!client.approvalReportEmail) {
    throw new TypeError(
      "Add an Approval / Report Email to this client before sending a connection request.",
    );
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + REQUEST_DURATION_MS);
  const token = createSecureToken();

  await requests.updateMany(
    {
      clientId: clientObjectId,
      requestedPlatforms: { $in: requestedPlatforms },
      status: { $in: ["pending", "email_failed"] },
    },
    {
      $set: {
        status: "revoked",
        revokedAt: now,
        updatedAt: now,
      },
    },
  );

  const document = {
    clientId: clientObjectId,
    email: client.approvalReportEmail,
    requestedPlatforms,
    platformStatus: createRequestedPlatformStatus(requestedPlatforms),
    tokenHash: hashSecureToken(token),
    status: "pending",
    expiresAt,
    createdAt: now,
    updatedAt: now,
  };
  const result = await requests.insertOne(document);

  const safeDocument = { ...document };
  delete safeDocument.tokenHash;

  return {
    token,
    client: serializeDocument(client),
    request: serializeDocument({ ...safeDocument, _id: result.insertedId }),
  };
}

export async function setConnectionRequestEmailResult(
  id,
  { status, providerMessageId = "", errorMessage = "" },
) {
  const objectId = toObjectId(id);

  if (!objectId) return null;

  const { requests } = await connectionCollections();
  const update = {
    emailStatus: status,
    emailProviderMessageId: providerMessageId,
    emailError: errorMessage,
    emailUpdatedAt: new Date(),
    updatedAt: new Date(),
  };

  if (status === "failed") {
    update.status = "email_failed";
  }

  return serializeDocument(
    await requests.findOneAndUpdate(
      { _id: objectId },
      { $set: update },
      { returnDocument: "after" },
    ),
  );
}

export async function recordEmailLog(input) {
  const { emailLog } = await connectionCollections();
  await emailLog.insertOne({
    type: input.type,
    clientId: toObjectId(input.clientId),
    requestId: toObjectId(input.requestId),
    recipient: input.recipient,
    status: input.status,
    providerMessageId: input.providerMessageId || "",
    errorMessage: input.errorMessage || "",
    createdAt: new Date(),
  });
}

export async function getConnectionRequestByToken(token) {
  if (!token) return null;

  const { clients, requests } = await connectionCollections();
  const request = await requests.findOne({
    tokenHash: hashSecureToken(token),
  });

  if (!request) return null;

  const client = await clients.findOne(
    { _id: request.clientId },
    { projection: { name: 1, approvalReportEmail: 1 } },
  );
  const now = new Date();
  let status = request.status;

  if (
    request.expiresAt <= now &&
    !["completed", "revoked"].includes(status)
  ) {
    status = "expired";
  }

  const safeRequest = { ...request };
  delete safeRequest.tokenHash;

  return serializeDocument({
    ...safeRequest,
    status,
    clientName: client?.name || "Client",
  });
}

export async function createFacebookOauthState({
  clientId,
  mode,
  requestId = null,
}) {
  const clientObjectId = toObjectId(clientId);

  if (!clientObjectId) {
    throw new TypeError("Choose a valid client.");
  }

  const { clients, oauthStates } = await connectionCollections();

  if (!(await clients.findOne({ _id: clientObjectId }, { projection: { _id: 1 } }))) {
    throw new TypeError("Choose a valid client.");
  }

  const state = createSecureToken();
  const now = new Date();

  await oauthStates.insertOne({
    stateHash: hashSecureToken(state),
    clientId: clientObjectId,
    requestId: requestId ? toObjectId(requestId) : null,
    mode,
    createdAt: now,
    expiresAt: new Date(now.getTime() + OAUTH_STATE_DURATION_MS),
    consumedAt: null,
  });

  return state;
}

export async function consumeFacebookOauthState(state) {
  if (!state) return null;

  const { oauthStates } = await connectionCollections();
  const now = new Date();

  return serializeDocument(
    await oauthStates.findOneAndUpdate(
      {
        stateHash: hashSecureToken(state),
        consumedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { consumedAt: now } },
      { returnDocument: "before" },
    ),
  );
}

export async function createInstagramOauthState({
  clientId,
  mode,
  requestId = null,
}) {
  const clientObjectId = toObjectId(clientId);

  if (!clientObjectId) {
    throw new TypeError("Choose a valid client.");
  }

  const { clients, oauthStates } = await connectionCollections();

  if (!(await clients.findOne({ _id: clientObjectId }, { projection: { _id: 1 } }))) {
    throw new TypeError("Choose a valid client.");
  }

  const state = createSecureToken();
  const now = new Date();

  await oauthStates.insertOne({
    stateHash: hashSecureToken(state),
    clientId: clientObjectId,
    requestId: requestId ? toObjectId(requestId) : null,
    mode,
    platform: "instagram",
    createdAt: now,
    expiresAt: new Date(now.getTime() + OAUTH_STATE_DURATION_MS),
    consumedAt: null,
  });

  return state;
}

export async function consumeInstagramOauthState(state) {
  if (!state) return null;

  const { oauthStates } = await connectionCollections();
  const now = new Date();

  return serializeDocument(
    await oauthStates.findOneAndUpdate(
      {
        stateHash: hashSecureToken(state),
        platform: "instagram",
        consumedAt: null,
        expiresAt: { $gt: now },
      },
      { $set: { consumedAt: now } },
      { returnDocument: "before" },
    ),
  );
}

export async function createLinkedInOauthState({
  clientId, mode, requestId = null,
}) {
  const clientObjectId = toObjectId(clientId);
  if (!clientObjectId) throw new TypeError("Choose a valid client.");
  const { clients, oauthStates } = await connectionCollections();
  if (!(await clients.findOne({ _id: clientObjectId }, { projection: { _id: 1 } }))) {
    throw new TypeError("Choose a valid client.");
  }
  if (!["owner", "request"].includes(mode)) throw new TypeError("Invalid LinkedIn authorization mode.");
  const state = createSecureToken();
  const now = new Date();
  await oauthStates.insertOne({
    stateHash: hashSecureToken(state),
    clientId: clientObjectId,
    requestId: requestId ? toObjectId(requestId) : null,
    mode, platform: "linkedin", createdAt: now,
    expiresAt: new Date(now.getTime() + OAUTH_STATE_DURATION_MS),
    consumedAt: null,
  });
  return state;
}

export async function createLinkedInReconnectState({ clientId, connectionId }) {
  const clientObjectId = toObjectId(clientId);
  const connectionObjectId = toObjectId(connectionId);
  if (!clientObjectId || !connectionObjectId) {
    throw new TypeError("Choose a valid LinkedIn connection.");
  }
  const { connections, oauthStates } = await connectionCollections();
  const current = await connections.findOne({
    _id: connectionObjectId,
    clientId: clientObjectId,
    platform: "linkedin",
  }, { projection: { providerAccountId: 1 } });
  if (!current) throw new TypeError("LinkedIn connection not found for this client.");
  const state = createSecureToken();
  const now = new Date();
  await oauthStates.insertOne({
    stateHash: hashSecureToken(state),
    clientId: clientObjectId,
    mode: "owner",
    platform: "linkedin",
    expectedProviderAccountId: current.providerAccountId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + OAUTH_STATE_DURATION_MS),
    consumedAt: null,
  });
  return state;
}

export async function consumeLinkedInOauthState(state) {
  if (!state) return null;
  const { oauthStates } = await connectionCollections();
  return serializeDocument(await oauthStates.findOneAndUpdate(
    { stateHash: hashSecureToken(state), platform: "linkedin",
      consumedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
    { returnDocument: "before" },
  ));
}

export async function createLinkedInSelectionFlow({
  clientId, requestId = null, mode, profile, accessToken, grantedScopes, tokenExpiresAt,
}) {
  const { selectionFlows } = await connectionCollections();
  const token = createSecureToken();
  const now = new Date();
  await selectionFlows.insertOne({
    tokenHash: hashSecureToken(token),
    clientId: toObjectId(clientId),
    requestId: requestId ? toObjectId(requestId) : null,
    mode, platform: "linkedin",
    providerAccountId: profile.providerAccountId,
    accountName: profile.accountName,
    pictureUrl: profile.pictureUrl,
    tokenEncrypted: encryptSecret(accessToken),
    grantedScopes, tokenExpiresAt,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SELECTION_DURATION_MS),
    consumedAt: null,
  });
  return token;
}

export async function getLinkedInSelectionFlow(token) {
  if (!token) return null;
  const { clients, selectionFlows } = await connectionCollections();
  const flow = await selectionFlows.findOne({
    tokenHash: hashSecureToken(token), platform: "linkedin",
    consumedAt: null, expiresAt: { $gt: new Date() },
  });
  if (!flow) return null;
  const client = await clients.findOne({ _id: flow.clientId }, { projection: { name: 1 } });
  return serializeDocument({
    clientId: flow.clientId,
    clientName: client?.name || "Client",
    mode: flow.mode,
    providerAccountId: flow.providerAccountId,
    accountName: flow.accountName,
    pictureUrl: flow.pictureUrl,
    expiresAt: flow.expiresAt,
    tokenExpiresAt: flow.tokenExpiresAt,
    grantedScopes: flow.grantedScopes,
  });
}


export async function createYouTubeOauthState({ clientId, mode = "owner", requestId = null }) {
  const id = toObjectId(clientId);
  if (!id) throw new TypeError("Choose a valid client.");
  if (!["owner", "request"].includes(mode) || (mode === "request" && !toObjectId(requestId)) ||
      (mode === "owner" && requestId)) {
    throw new TypeError("Invalid YouTube authorization mode.");
  }
  const { clients, oauthStates } = await connectionCollections();
  if (!await clients.findOne({ _id: id }, { projection: { _id: 1 } })) {
    throw new TypeError("Choose a valid client.");
  }
  const state = createSecureToken();
  const now = new Date();
  await oauthStates.insertOne({ stateHash: hashSecureToken(state), clientId: id,
    requestId: mode === "request" ? toObjectId(requestId) : null,
    platform: "youtube", mode, consumedAt: null, createdAt: now,
    expiresAt: new Date(now.getTime() + OAUTH_STATE_DURATION_MS) });
  return state;
}
export async function createYouTubeReconnectState({ clientId, connectionId }) {
  const id = toObjectId(clientId), connectionObjectId = toObjectId(connectionId);
  if (!id || !connectionObjectId) throw new TypeError("Choose a valid YouTube connection.");
  const { connections, oauthStates } = await connectionCollections();
  const previous = await connections.findOne({
    _id: connectionObjectId, clientId: id, platform: "youtube",
  });
  if (!previous) throw new TypeError("YouTube connection not found for this client.");
  const state = createSecureToken();
  const now = new Date();
  await oauthStates.insertOne({ stateHash: hashSecureToken(state), clientId: id,
    platform: "youtube", mode: "owner", expectedProviderAccountId: previous.providerAccountId,
    consumedAt: null, createdAt: now, expiresAt: new Date(now.getTime() + OAUTH_STATE_DURATION_MS) });
  return state;
}
export async function consumeYouTubeOauthState(value) {
  if (!value) return null;
  const { oauthStates } = await connectionCollections();
  return serializeDocument(await oauthStates.findOneAndUpdate({
    stateHash: hashSecureToken(value), platform: "youtube", consumedAt: null,
    expiresAt: { $gt: new Date() },
  }, { $set: { consumedAt: new Date() } }, { returnDocument: "before" }));
}
export async function createYouTubeSelectionFlow({ state, channel, tokens }) {
  const { selectionFlows } = await connectionCollections();
  const token = createSecureToken();
  const now = new Date();
  await selectionFlows.insertOne({
    tokenHash: hashSecureToken(token), platform: "youtube",
    clientId: toObjectId(state.clientId), mode: state.mode,
    requestId: state.requestId ? toObjectId(state.requestId) : null,
    providerAccountId: channel.providerAccountId, expectedProviderAccountId: state.expectedProviderAccountId || null,
    accountName: channel.accountName, pictureUrl: channel.pictureUrl,
    tokenEncrypted: encryptSecret(tokens.accessToken),
    refreshTokenEncrypted: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
    grantedScopes: tokens.grantedScopes, tokenExpiresAt: tokens.expiresAt,
    consumedAt: null, createdAt: now, expiresAt: new Date(now.getTime() + SELECTION_DURATION_MS),
  });
  return token;
}
export async function getYouTubeSelectionFlow(value) {
  if (!value) return null;
  const { clients, selectionFlows } = await connectionCollections();
  const flow = await selectionFlows.findOne({
    tokenHash: hashSecureToken(value), platform: "youtube", consumedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!flow) return null;
  const client = await clients.findOne({ _id: flow.clientId }, { projection: { name: 1 } });
  return serializeDocument({
    clientId: flow.clientId, clientName: client?.name || "Client", mode: flow.mode,
    accountName: flow.accountName, providerAccountId: flow.providerAccountId,
    expiresAt: flow.expiresAt,
  });
}
export async function completeYouTubeSelection(value) {
  if (!value) throw new TypeError("Restart YouTube Connect and confirm the channel.");
  const { connections, requests, selectionFlows } = await connectionCollections();
  const now = new Date();
  // Atomic consume prevents two confirmation requests from persisting the same flow.
  const flow = await selectionFlows.findOneAndUpdate({
    tokenHash: hashSecureToken(value), platform: "youtube",
    consumedAt: null, expiresAt: { $gt: now },
  }, { $set: { consumedAt: now } }, { returnDocument: "before" });
  if (!flow) throw new TypeError("This YouTube confirmation expired or was already used.");
  if (flow.mode !== "owner" && flow.mode !== "request") {
    throw new TypeError("Invalid YouTube connection flow.");
  }
  const connectionRequest = flow.mode === "request"
    ? await getActiveConnectionRequestForFlow(requests, flow, "youtube", now)
    : null;
  if (flow.mode === "request" && !connectionRequest) {
    throw new TypeError("YouTube connection request is no longer available.");
  }
  const channel = await getAuthorizedYouTubeChannel(decryptSecret(flow.tokenEncrypted));
  assertSameYouTubeChannel(flow.providerAccountId, channel.providerAccountId);
  assertSameYouTubeChannel(flow.expectedProviderAccountId, channel.providerAccountId);
  const identity = { clientId: flow.clientId, platform: "youtube", providerAccountId: channel.providerAccountId };
  const prior = await connections.findOne(identity);
  if (!flow.refreshTokenEncrypted && !prior?.refreshTokenEncrypted) {
    throw new TypeError("Google did not grant renewable YouTube access. Restart Connect and approve offline access.");
  }
  // A refresh token is preserved when Google declines to re-issue it on the same-channel reconnect.
  const refreshTokenEncrypted = flow.refreshTokenEncrypted || prior.refreshTokenEncrypted;
  const health = getYouTubeHealth({ grantedScopes: flow.grantedScopes,
    tokenExpiresAt: flow.tokenExpiresAt, hasRefreshToken: true, channelId: channel.providerAccountId, now });
  const connection = await connections.findOneAndUpdate(identity, {
    $set: { ...identity, accountName: channel.accountName, pictureUrl: channel.pictureUrl,
      tokenEncrypted: flow.tokenEncrypted, refreshTokenEncrypted,
      tokenExpiresAt: flow.tokenExpiresAt, tokenIssuedAt: now, grantedScopes: flow.grantedScopes,
      capabilities: { canPublish: health.canPublish }, healthStatus: health.healthStatus,
      healthMessage: health.healthMessage, missingPermissions: health.missingPermissions,
      lastHealthCheckAt: now, lastSuccessfulCheckAt: health.canPublish ? now : prior?.lastSuccessfulCheckAt || null,
      updatedAt: now,
    }, $setOnInsert: { createdAt: now },
  }, { upsert: true, returnDocument: "after" });
  await completeConnectionRequestPlatform(requests, connectionRequest, "youtube", now);
  return serializeDocument(removeEncryptedToken(connection));
}
async function refreshYouTubeConnectionHealth(connections, connection, objectId, now, forceRefresh = false) {
  let accessToken = decryptSecret(connection.tokenEncrypted);
  let grantedScopes = connection.grantedScopes;
  let expiresAt = connection.tokenExpiresAt;
  let refreshed = null;
  if (forceRefresh || !expiresAt || new Date(expiresAt).getTime() - now.getTime() < 5 * 60 * 1000) {
    if (!connection.refreshTokenEncrypted) throw new TypeError("YouTube refresh authorization is missing.");
    refreshed = await refreshYouTubeToken(decryptSecret(connection.refreshTokenEncrypted));
    accessToken = refreshed.accessToken;
    // Some Google refresh responses omit scope; retain the originally consented scopes.
    grantedScopes = refreshed.grantedScopes.length ? refreshed.grantedScopes : grantedScopes;
    expiresAt = refreshed.expiresAt;
  }
  const channel = await getAuthorizedYouTubeChannel(accessToken);
  assertSameYouTubeChannel(connection.providerAccountId, channel.providerAccountId);
  const health = getYouTubeHealth({ grantedScopes, tokenExpiresAt: expiresAt,
    hasRefreshToken: Boolean(connection.refreshTokenEncrypted), channelId: channel.providerAccountId, now });
  const update = {
    accountName: channel.accountName, pictureUrl: channel.pictureUrl, tokenExpiresAt: expiresAt,
    grantedScopes, healthStatus: health.healthStatus, healthMessage: health.healthMessage,
    missingPermissions: health.missingPermissions, capabilities: { canPublish: health.canPublish },
    lastHealthCheckAt: now, lastSuccessfulCheckAt: health.canPublish ? now : connection.lastSuccessfulCheckAt || null,
    updatedAt: now,
  };
  if (refreshed) {
    update.tokenEncrypted = encryptSecret(refreshed.accessToken);
    if (refreshed.refreshToken) update.refreshTokenEncrypted = encryptSecret(refreshed.refreshToken);
  }
  return connections.findOneAndUpdate({ _id: objectId, tokenEncrypted: connection.tokenEncrypted },
    { $set: update }, { returnDocument: "after" });
}

export async function createGoogleBusinessOauthState({ clientId, connectionId = "", mode = "owner", requestId = null }) {
  const clientObjectId = toObjectId(clientId);
  const connectionObjectId = connectionId ? toObjectId(connectionId) : null;
  if (!clientObjectId || (connectionId && !connectionObjectId)) throw new TypeError("Choose a valid client and business connection.");
  const requestObjectId = requestId ? toObjectId(requestId) : null;
  if (!["owner", "request"].includes(mode) ||
      (mode === "request" && (!requestObjectId || connectionId)) ||
      (mode === "owner" && requestId)) throw new TypeError("Invalid Google Business authorization mode.");
  const { clients, connections, oauthStates, requests } = await connectionCollections();
  if (!await clients.findOne({ _id: clientObjectId })) throw new TypeError("Client no longer exists.");
  if (mode === "request") {
    await getActiveConnectionRequestForFlow(requests, {
      clientId: clientObjectId, requestId: requestObjectId,
    }, GOOGLE_BUSINESS_PLATFORM, new Date());
  }
  const previous = connectionObjectId ? await connections.findOne({
    _id: connectionObjectId, clientId: clientObjectId, platform: GOOGLE_BUSINESS_PLATFORM,
  }) : null;
  if (connectionObjectId && !previous) throw new TypeError("Business connection not found for this client.");
  const value = createSecureToken(), now = new Date();
  await oauthStates.insertOne({ stateHash: hashSecureToken(value), clientId: clientObjectId,
    platform: GOOGLE_BUSINESS_PLATFORM, mode, requestId: requestObjectId, consumedAt: null, createdAt: now,
    expectedConnectionId: connectionObjectId,
    expectedProviderAccountId: previous?.providerAccountId || null,
    expectedAccountResourceName: previous?.accountResourceName || null,
    expectedTokenEncrypted: previous?.tokenEncrypted || null,
    oauthClientId: requireEnv("GOOGLE_BUSINESS_CLIENT_ID"),
    expiresAt: new Date(+now + OAUTH_STATE_DURATION_MS) });
  return value;
}

export async function consumeGoogleBusinessOauthState(value) {
  if (typeof value !== "string" || !value) return null;
  const { oauthStates } = await connectionCollections();
  return serializeDocument(await oauthStates.findOneAndUpdate({ stateHash: hashSecureToken(value),
    platform: GOOGLE_BUSINESS_PLATFORM, mode: { $in: ["owner", "request"] }, consumedAt: null, expiresAt: { $gt: new Date() },
  }, { $set: { consumedAt: new Date() } }, { returnDocument: "before" }));
}

export async function createGoogleBusinessSelectionFlow({ state, locations, tokens }) {
  if (!["owner", "request"].includes(state.mode) || !locations.length) throw new TypeError("No business locations were available. Use an owner or manager Google account.");
  if (state.mode === "request" && !state.requestId) throw new TypeError("Connection request is missing.");
  if (!tokens.grantedScopes.includes(GOOGLE_BUSINESS_SCOPE)) throw new TypeError("Google Business Profile permission was not granted.");
  const eligible = locations.filter(location =>
    (!state.expectedProviderAccountId || location.providerAccountId === state.expectedProviderAccountId) &&
    (!state.expectedAccountResourceName || location.accountResourceName === state.expectedAccountResourceName));
  if (!eligible.length) throw new TypeError("The original business location was not returned. The existing connection was not replaced.");
  const { requests, selectionFlows } = await connectionCollections();
  if (state.mode === "request") {
    await getActiveConnectionRequestForFlow(requests, state, GOOGLE_BUSINESS_PLATFORM, new Date());
  }
  const value = createSecureToken(), now = new Date();
  await selectionFlows.insertOne({ tokenHash: hashSecureToken(value), platform: GOOGLE_BUSINESS_PLATFORM,
    mode: state.mode, clientId: toObjectId(state.clientId),
    requestId: state.requestId ? toObjectId(state.requestId) : null, locations: eligible,
    expectedConnectionId: toObjectId(state.expectedConnectionId),
    expectedProviderAccountId: state.expectedProviderAccountId,
    expectedAccountResourceName: state.expectedAccountResourceName,
    expectedTokenEncrypted: state.expectedTokenEncrypted,
    oauthClientId: state.oauthClientId,
    tokenEncrypted: encryptSecret(tokens.accessToken),
    refreshTokenEncrypted: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
    tokenExpiresAt: tokens.expiresAt, grantedScopes: tokens.grantedScopes,
    consumedAt: null, createdAt: now, expiresAt: new Date(+now + SELECTION_DURATION_MS) });
  return value;
}

export async function getGoogleBusinessSelectionFlow(value) {
  if (typeof value !== "string" || !value) return null;
  const { clients, selectionFlows } = await connectionCollections();
  const flow = await selectionFlows.findOne({ tokenHash: hashSecureToken(value), platform: GOOGLE_BUSINESS_PLATFORM,
    mode: { $in: ["owner", "request"] }, consumedAt: null, expiresAt: { $gt: new Date() } });
  if (!flow) return null;
  const client = await clients.findOne({ _id: flow.clientId }, { projection: { name: 1 } });
  if (!client) return null;
  return serializeDocument({ clientId: flow.clientId, clientName: client.name,
    mode: flow.mode, locations: flow.locations, expiresAt: flow.expiresAt, reconnecting: Boolean(flow.expectedConnectionId) });
}

export async function completeGoogleBusinessSelection(value, providerParent) {
  if (typeof value !== "string" || !value || typeof providerParent !== "string") throw new TypeError("Choose a business location.");
  const { clients, connections, requests, selectionFlows } = await connectionCollections();
  const query = { tokenHash: hashSecureToken(value), platform: GOOGLE_BUSINESS_PLATFORM,
    mode: { $in: ["owner", "request"] }, consumedAt: null, expiresAt: { $gt: new Date() } };
  const candidateFlow = await selectionFlows.findOne(query);
  const selected = candidateFlow?.locations?.find(location => location.providerParent === providerParent);
  if (!selected) throw new TypeError("This location was not offered by Google. Restart Connect if the selection expired.");
  const now = new Date();
  const flow = await selectionFlows.findOneAndUpdate(query,
    { $set: { consumedAt: now } }, { returnDocument: "before" });
  if (!flow) throw new TypeError("This confirmation expired or was already used. Restart Google Business Connect.");
  if (!["owner", "request"].includes(flow.mode)) throw new TypeError("Invalid connection mode.");
  if (!await clients.findOne({ _id: flow.clientId })) throw new TypeError("Client no longer exists.");
  if (flow.oauthClientId !== requireEnv("GOOGLE_BUSINESS_CLIENT_ID")) throw new TypeError("Google credentials changed. Restart Connect.");
  const connectionRequest = flow.mode === "request"
    ? await getActiveConnectionRequestForFlow(requests, flow, GOOGLE_BUSINESS_PLATFORM, new Date()) : null;
  if (flow.mode === "request" && !connectionRequest) throw new TypeError("Connection request is no longer available.");
  const location = await verifyGoogleBusinessLocation(decryptSecret(flow.tokenEncrypted),
    selected.accountResourceName, selected.locationResourceName);
  assertSameGoogleBusinessLocation(selected.providerAccountId, location.providerAccountId,
    selected.accountResourceName, location.accountResourceName);
  assertSameGoogleBusinessLocation(flow.expectedProviderAccountId, location.providerAccountId,
    flow.expectedAccountResourceName, location.accountResourceName);
  const identity = { clientId: flow.clientId, platform: GOOGLE_BUSINESS_PLATFORM, providerAccountId: location.providerAccountId };
  const prior = await connections.findOne(identity);
  if (flow.expectedConnectionId && (!prior || String(prior._id) !== String(flow.expectedConnectionId)
    || prior.tokenEncrypted !== flow.expectedTokenEncrypted)) throw new TypeError("This connection changed during authorization. Restart Reconnect.");
  const refreshTokenEncrypted = flow.refreshTokenEncrypted ||
    (prior?.oauthClientId === flow.oauthClientId ? prior.refreshTokenEncrypted : null);
  if (!refreshTokenEncrypted) throw new TypeError("Google did not grant offline access. Restart Connect and approve Business Profile access.");
  const health = getGoogleBusinessHealth({ grantedScopes: flow.grantedScopes, tokenExpiresAt: flow.tokenExpiresAt,
    hasRefreshToken: true, locationId: location.providerAccountId, now });
  if (!health.canManageLocation) throw new TypeError(health.healthMessage);
  // Recheck immediately before persistence so revoked/replaced/expired requests cannot save.
  if (flow.mode === "request") {
    await getActiveConnectionRequestForFlow(requests, flow, GOOGLE_BUSINESS_PLATFORM, new Date());
  }
  const filter = prior ? { ...identity, _id: prior._id, tokenEncrypted: prior.tokenEncrypted } : identity;
  const saved = await connections.findOneAndUpdate(filter, { $set: { ...identity, ...location,
    googleAccountName: selected.googleAccountName, oauthClientId: flow.oauthClientId,
    tokenEncrypted: flow.tokenEncrypted, refreshTokenEncrypted, tokenExpiresAt: flow.tokenExpiresAt,
    tokenIssuedAt: now, grantedScopes: flow.grantedScopes, healthStatus: health.healthStatus,
    healthMessage: health.healthMessage, missingPermissions: health.missingPermissions,
    capabilities: { canManageLocation: health.canManageLocation, canPublish: false },
    lastHealthCheckAt: now, lastSuccessfulCheckAt: now, updatedAt: now,
  }, $setOnInsert: { createdAt: now } }, { upsert: !prior, returnDocument: "after" });
  if (!saved) throw new TypeError("This connection changed during authorization. Restart Connect.");
  await completeConnectionRequestPlatform(requests, connectionRequest, GOOGLE_BUSINESS_PLATFORM, now);
  return serializeDocument(removeEncryptedToken(saved));
}

export async function refreshGoogleBusinessConnectionHealth(connections, connection, objectId, now) {
  if (connection.oauthClientId !== requireEnv("GOOGLE_BUSINESS_CLIENT_ID")) throw new TypeError("Google credentials changed. Reconnect this business location.");
  let accessToken = decryptSecret(connection.tokenEncrypted), refreshed = null;
  let grantedScopes = connection.grantedScopes, expiresAt = connection.tokenExpiresAt;
  const expires = new Date(expiresAt || 0).getTime();
  if (!Number.isFinite(expires) || expires - now.getTime() < 5 * 60 * 1000) {
    if (!connection.refreshTokenEncrypted) throw new TypeError("Google refresh authorization is missing. Reconnect.");
    refreshed = await refreshGoogleBusinessToken(decryptSecret(connection.refreshTokenEncrypted));
    accessToken = refreshed.accessToken;
    grantedScopes = refreshed.grantedScopes.length ? refreshed.grantedScopes : grantedScopes;
    expiresAt = refreshed.expiresAt;
  }
  const location = await verifyGoogleBusinessLocation(accessToken, connection.accountResourceName, connection.locationResourceName);
  assertSameGoogleBusinessLocation(connection.providerAccountId, location.providerAccountId,
    connection.accountResourceName, location.accountResourceName);
  const health = getGoogleBusinessHealth({ grantedScopes, tokenExpiresAt: expiresAt,
    hasRefreshToken: Boolean(connection.refreshTokenEncrypted), locationId: location.providerAccountId, now });
  const update = { accountName: location.accountName, address: location.address,
    tokenExpiresAt: expiresAt, grantedScopes, healthStatus: health.healthStatus, healthMessage: health.healthMessage,
    missingPermissions: health.missingPermissions, capabilities: { canManageLocation: health.canManageLocation, canPublish: false },
    lastHealthCheckAt: now, lastSuccessfulCheckAt: health.canManageLocation ? now : connection.lastSuccessfulCheckAt || null,
    updatedAt: now };
  if (refreshed) {
    update.tokenEncrypted = encryptSecret(refreshed.accessToken);
    if (refreshed.refreshToken) update.refreshTokenEncrypted = encryptSecret(refreshed.refreshToken);
    update.tokenRenewedAt = now;
  }
  return await connections.findOneAndUpdate({ _id: objectId, clientId: connection.clientId,
    platform: GOOGLE_BUSINESS_PLATFORM, tokenEncrypted: connection.tokenEncrypted },
    { $set: update }, { returnDocument: "after" }) || connections.findOne({ _id: objectId });
}

export async function createFacebookSelectionFlow({
  clientId,
  requestId = null,
  mode,
  pages,
  permissions,
  diagnostics = null,
}) {
  const { selectionFlows } = await connectionCollections();
  const token = createSecureToken();
  const now = new Date();

  const candidates = pages.map((page) => ({
    providerAccountId: page.providerAccountId,
    accountName: page.accountName,
    pictureUrl: page.pictureUrl,
    tasks: page.tasks,
    tokenEncrypted: encryptSecret(page.accessToken),
  }));

  await selectionFlows.insertOne({
    tokenHash: hashSecureToken(token),
    clientId: new ObjectId(clientId),
    requestId: requestId ? new ObjectId(requestId) : null,
    mode,
    platform: "facebook",
    permissions,
    diagnostics,
    candidates,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SELECTION_DURATION_MS),
    consumedAt: null,
  });

  return token;
}

export async function getFacebookSelectionFlow(token) {
  if (!token) return null;

  const { clients, selectionFlows } = await connectionCollections();
  const flow = await selectionFlows.findOne({
    tokenHash: hashSecureToken(token),
    platform: "facebook",
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!flow) return null;

  const client = await clients.findOne(
    { _id: flow.clientId },
    { projection: { name: 1 } },
  );

  return serializeDocument({
    _id: flow._id,
    clientId: flow.clientId,
    clientName: client?.name || "Client",
    mode: flow.mode,
    expiresAt: flow.expiresAt,
    diagnostics: flow.diagnostics || null,
    candidates: flow.candidates.map((candidate) =>
      removeEncryptedToken(candidate),
    ),
  });
}

export async function createInstagramSelectionFlow({
  clientId,
  requestId = null,
  mode,
  profile,
  accessToken,
  permissions,
  tokenExpiresAt,
}) {
  const { selectionFlows } = await connectionCollections();
  const token = createSecureToken();
  const now = new Date();

  await selectionFlows.insertOne({
    tokenHash: hashSecureToken(token),
    clientId: new ObjectId(clientId),
    requestId: requestId ? new ObjectId(requestId) : null,
    mode,
    platform: "instagram",
    providerAccountId: profile.providerAccountId,
    username: profile.username,
    accountName: profile.accountName,
    accountType: profile.accountType,
    pictureUrl: profile.pictureUrl,
    tokenEncrypted: encryptSecret(accessToken),
    grantedScopes: permissions,
    tokenExpiresAt,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SELECTION_DURATION_MS),
    consumedAt: null,
  });

  return token;
}

export async function getInstagramSelectionFlow(token) {
  if (!token) return null;

  const { clients, selectionFlows } = await connectionCollections();
  const flow = await selectionFlows.findOne({
    tokenHash: hashSecureToken(token),
    platform: "instagram",
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!flow) return null;

  const client = await clients.findOne(
    { _id: flow.clientId },
    { projection: { name: 1 } },
  );
  const health = getInstagramHealth({
    grantedScopes: flow.grantedScopes,
    accountType: flow.accountType,
    tokenExpiresAt: flow.tokenExpiresAt,
  });

  return serializeDocument({
    _id: flow._id,
    clientId: flow.clientId,
    clientName: client?.name || "Client",
    mode: flow.mode,
    expiresAt: flow.expiresAt,
    providerAccountId: flow.providerAccountId,
    username: flow.username,
    accountName: flow.accountName,
    accountType: flow.accountType,
    pictureUrl: flow.pictureUrl,
    grantedScopes: flow.grantedScopes,
    missingPermissions: health.missingPermissions,
  });
}

function getHealthStatus({ permissions, tasks, tokenDetails }) {
  const required = getFacebookRequiredPermissions();
  const granted = new Set([
    ...(permissions || []),
    ...(tokenDetails.scopes || []),
  ]);
  const missingPermissions = required.filter(
    (permission) => !granted.has(permission),
  );
  const canCreateContent = (tasks || []).includes("CREATE_CONTENT");

  if (!tokenDetails.isValid) {
    return {
      healthStatus: "expired",
      healthMessage: "Facebook reports that this access token is no longer valid.",
      missingPermissions,
      canPublish: false,
    };
  }

  if (missingPermissions.length || !canCreateContent) {
    return {
      healthStatus: "permission_problem",
      healthMessage: missingPermissions.length
        ? `Missing: ${missingPermissions.join(", ")}`
        : "The connected Facebook user cannot create Page content.",
      missingPermissions,
      canPublish: false,
    };
  }

  return {
    healthStatus: "healthy",
    healthMessage: "",
    missingPermissions: [],
    canPublish: true,
  };
}

async function getActiveConnectionRequestForFlow(
  requests,
  flow,
  platform,
  now,
) {
  if (!flow.requestId) return null;

  const request = await requests.findOne({
    _id: flow.requestId,
    clientId: flow.clientId,
  });

  if (!isConnectionRequestUsableForPlatform(request, platform, now)) {
    throw new TypeError(
      "This connection request is no longer available. Ask for a fresh connection link.",
    );
  }

  return request;
}

async function completeConnectionRequestPlatform(
  requests,
  request,
  platform,
  now,
) {
  if (!request) return;

  const next = markConnectionRequestPlatformConnected(request, platform);
  const update = {
    platformStatus: next.platformStatus,
    status: next.status,
    updatedAt: now,
  };

  if (next.completed) {
    update.completedAt = now;
  }

  await requests.updateOne(
    {
      _id: request._id,
      clientId: request.clientId,
      status: "pending",
    },
    { $set: update },
  );
}

export async function completeFacebookSelection(token, providerAccountId) {
  if (!token || !providerAccountId) {
    throw new TypeError("Choose a Facebook Page.");
  }

  const {
    connections,
    requests,
    selectionFlows,
  } = await connectionCollections();
  const flow = await selectionFlows.findOne({
    tokenHash: hashSecureToken(token),
    platform: "facebook",
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!flow) {
    throw new TypeError("This Facebook account-selection link has expired.");
  }

  const candidate = flow.candidates.find(
    (item) => item.providerAccountId === providerAccountId,
  );

  if (!candidate) {
    throw new TypeError("Choose a Facebook Page from this connection attempt.");
  }

  const now = new Date();
  const connectionRequest = await getActiveConnectionRequestForFlow(
    requests,
    flow,
    "facebook",
    now,
  );
  const pageAccessToken = decryptSecret(candidate.tokenEncrypted);
  const [page, tokenDetails] = await Promise.all([
    checkFacebookPage(candidate.providerAccountId, pageAccessToken),
    inspectFacebookToken(pageAccessToken),
  ]);
  const health = getHealthStatus({
    permissions: flow.permissions,
    tasks: candidate.tasks,
    tokenDetails,
  });
  const document = {
    clientId: flow.clientId,
    platform: "facebook",
    providerAccountId: page.providerAccountId,
    accountName: page.accountName,
    pictureUrl: page.pictureUrl || candidate.pictureUrl,
    tokenEncrypted: candidate.tokenEncrypted,
    tokenExpiresAt: tokenDetails.expiresAt,
    dataAccessExpiresAt: tokenDetails.dataAccessExpiresAt,
    grantedScopes: [
      ...new Set([...(flow.permissions || []), ...(tokenDetails.scopes || [])]),
    ],
    tasks: candidate.tasks,
    capabilities: { canPublish: health.canPublish },
    healthStatus: health.healthStatus,
    healthMessage: health.healthMessage,
    missingPermissions: health.missingPermissions,
    lastHealthCheckAt: now,
    lastSuccessfulCheckAt:
      health.healthStatus === "healthy" ? now : null,
    updatedAt: now,
  };

  const connection = await connections.findOneAndUpdate(
    {
      clientId: flow.clientId,
      platform: "facebook",
      providerAccountId: page.providerAccountId,
    },
    {
      $set: document,
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );

  await selectionFlows.updateOne(
    { _id: flow._id, consumedAt: null },
    { $set: { consumedAt: now } },
  );
  await completeConnectionRequestPlatform(
    requests,
    connectionRequest,
    "facebook",
    now,
  );

  return serializeDocument(removeEncryptedToken(connection));
}

export async function completeInstagramSelection(token) {
  if (!token) {
    throw new TypeError("Restart the Instagram connection and confirm the account again.");
  }

  const { connections, requests, selectionFlows } = await connectionCollections();
  const flow = await selectionFlows.findOne({
    tokenHash: hashSecureToken(token),
    platform: "instagram",
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!flow) {
    throw new TypeError("This Instagram account-confirmation link has expired.");
  }

  const now = new Date();
  const connectionRequest = await getActiveConnectionRequestForFlow(
    requests,
    flow,
    "instagram",
    now,
  );
  const accessToken = decryptSecret(flow.tokenEncrypted);
  const profile = await getInstagramProfile(accessToken);

  if (profile.providerAccountId !== flow.providerAccountId) {
    throw new TypeError("Instagram account identity changed during authorization. Restart Connect.");
  }

  const health = getInstagramHealth({
    grantedScopes: flow.grantedScopes,
    accountType: profile.accountType,
    tokenExpiresAt: flow.tokenExpiresAt,
  });
  const identity = buildInstagramConnectionIdentity(
    flow.clientId,
    profile.providerAccountId,
  );
  const document = {
    ...identity,
    accountName: profile.accountName,
    username: profile.username,
    accountType: profile.accountType,
    pictureUrl: profile.pictureUrl || flow.pictureUrl,
    tokenEncrypted: flow.tokenEncrypted,
    tokenIssuedAt: now,
    tokenRenewedAt: null,
    tokenRefreshAttemptAt: null,
    tokenRefreshErrorAt: null,
    tokenExpiresAt: flow.tokenExpiresAt || null,
    dataAccessExpiresAt: null,
    grantedScopes: flow.grantedScopes || [],
    capabilities: { canPublish: health.canPublish },
    healthStatus: health.healthStatus,
    healthMessage: health.healthMessage,
    missingPermissions: health.missingPermissions,
    lastHealthCheckAt: now,
    lastSuccessfulCheckAt: health.canPublish ? now : null,
    updatedAt: now,
  };

  const connection = await connections.findOneAndUpdate(
    identity,
    {
      $set: document,
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );

  await selectionFlows.updateOne(
    { _id: flow._id, consumedAt: null },
    { $set: { consumedAt: now } },
  );
  await completeConnectionRequestPlatform(
    requests,
    connectionRequest,
    "instagram",
    now,
  );

  return serializeDocument(removeEncryptedToken(connection));
}

export async function completeLinkedInSelection(token) {
  if (!token) throw new TypeError("Restart LinkedIn Connect and confirm the profile.");
  const { connections, requests, selectionFlows } = await connectionCollections();
  const flow = await selectionFlows.findOne({
    tokenHash: hashSecureToken(token), platform: "linkedin",
    consumedAt: null, expiresAt: { $gt: new Date() },
  });
  if (!flow) throw new TypeError("This LinkedIn confirmation link expired.");
  const now = new Date();
  const connectionRequest = await getActiveConnectionRequestForFlow(
    requests, flow, "linkedin", now,
  );
  const profile = await getLinkedInProfile(decryptSecret(flow.tokenEncrypted));
  if (profile.providerAccountId !== flow.providerAccountId) {
    throw new TypeError("LinkedIn member identity changed. Restart Connect.");
  }
  const identity = {
    clientId: flow.clientId, platform: "linkedin",
    providerAccountId: profile.providerAccountId,
  };
  const health = getLinkedInHealth({
    grantedScopes: flow.grantedScopes,
    tokenExpiresAt: flow.tokenExpiresAt,
    now,
  });
  const previous = await connections.findOne(identity);
  const connection = await connections.findOneAndUpdate(identity, {
    $set: {
      ...identity,
      accountName: profile.accountName,
      pictureUrl: profile.pictureUrl || flow.pictureUrl,
      tokenEncrypted: flow.tokenEncrypted,
      tokenIssuedAt: now,
      tokenExpiresAt: flow.tokenExpiresAt,
      dataAccessExpiresAt: null,
      grantedScopes: flow.grantedScopes,
      capabilities: { canPublish: health.canPublish },
      healthStatus: health.healthStatus,
      healthMessage: health.healthMessage,
      missingPermissions: health.missingPermissions,
      lastHealthCheckAt: now,
      lastSuccessfulCheckAt: health.canPublish ? now : previous?.lastSuccessfulCheckAt || null,
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  }, { upsert: true, returnDocument: "after" });
  await selectionFlows.updateOne(
    { _id: flow._id, consumedAt: null },
    { $set: { consumedAt: now } },
  );
  await completeConnectionRequestPlatform(requests, connectionRequest, "linkedin", now);
  return serializeDocument(removeEncryptedToken(connection));
}

async function refreshLinkedInConnectionHealth(connections, connection, objectId, now) {
  const health = getLinkedInHealth({
    grantedScopes: connection.grantedScopes,
    tokenExpiresAt: connection.tokenExpiresAt,
    now,
  });
  if (health.healthStatus === "expired" || health.healthStatus === "permission_problem") {
    return connections.findOneAndUpdate(
      { _id: objectId, tokenEncrypted: connection.tokenEncrypted },
      { $set: {
        healthStatus: health.healthStatus,
        healthMessage: health.healthMessage,
        missingPermissions: health.missingPermissions,
        capabilities: { canPublish: false },
        lastHealthCheckAt: now,
        updatedAt: now,
      } }, { returnDocument: "after" },
    );
  }
  const accessToken = decryptSecret(connection.tokenEncrypted);
  const [profile, tokenDetails] = await Promise.all([
    getLinkedInProfile(accessToken),
    inspectLinkedInToken(accessToken),
  ]);
  const verifiedHealth = getLinkedInHealth({
    grantedScopes: tokenDetails.grantedScopes,
    tokenExpiresAt: tokenDetails.expiresAt || connection.tokenExpiresAt,
    now,
  });
  if (profile.providerAccountId !== connection.providerAccountId) {
    throw new TypeError("LinkedIn member identity does not match the saved connection.");
  }
  return connections.findOneAndUpdate(
    { _id: objectId, tokenEncrypted: connection.tokenEncrypted },
    { $set: {
      accountName: profile.accountName,
      pictureUrl: profile.pictureUrl || connection.pictureUrl,
      tokenExpiresAt: tokenDetails.expiresAt || connection.tokenExpiresAt,
      grantedScopes: tokenDetails.grantedScopes,
      healthStatus: verifiedHealth.healthStatus,
      healthMessage: verifiedHealth.healthMessage,
      missingPermissions: verifiedHealth.missingPermissions,
      capabilities: { canPublish: verifiedHealth.canPublish },
      lastHealthCheckAt: now,
      lastSuccessfulCheckAt: verifiedHealth.canPublish ? now : connection.lastSuccessfulCheckAt || null,
      updatedAt: now,
    } }, { returnDocument: "after" },
  );
}

async function refreshFacebookConnectionHealth(connections, connection, objectId, now) {
  const token = decryptSecret(connection.tokenEncrypted);
  const [page, tokenDetails] = await Promise.all([
    checkFacebookPage(connection.providerAccountId, token),
    inspectFacebookToken(token),
  ]);
  const health = getHealthStatus({
    permissions: connection.grantedScopes,
    tasks: connection.tasks,
    tokenDetails,
  });

  return connections.findOneAndUpdate(
    { _id: objectId },
    {
      $set: {
        accountName: page.accountName,
        pictureUrl: page.pictureUrl || connection.pictureUrl,
        tokenExpiresAt: tokenDetails.expiresAt,
        dataAccessExpiresAt: tokenDetails.dataAccessExpiresAt,
        healthStatus: health.healthStatus,
        healthMessage: health.healthMessage,
        missingPermissions: health.missingPermissions,
        capabilities: { canPublish: health.canPublish },
        lastHealthCheckAt: now,
        lastSuccessfulCheckAt:
          health.healthStatus === "healthy"
            ? now
            : connection.lastSuccessfulCheckAt || null,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
}

async function refreshInstagramConnectionHealth(
  connections,
  connection,
  objectId,
  now,
) {
  const renewal = await renewInstagramConnection({
    connections,
    connection,
    now,
    refreshToken: refreshInstagramAccessToken,
    getProfile: getInstagramProfile,
    decrypt: decryptSecret,
    encrypt: encryptSecret,
  });
  connection = renewal.connection;
  if (!connection) return null;
  const profile =
    renewal.profile ||
    (await getInstagramProfile(decryptSecret(connection.tokenEncrypted)));

  if (profile.providerAccountId !== connection.providerAccountId) {
    throw new TypeError("Instagram account identity no longer matches the saved connection.");
  }

  const health = getInstagramHealth({
    grantedScopes: connection.grantedScopes,
    accountType: profile.accountType,
    tokenExpiresAt: connection.tokenExpiresAt,
    now,
  });

  const updated = await connections.findOneAndUpdate(
    { _id: objectId, tokenEncrypted: connection.tokenEncrypted },
    {
      $set: {
        accountName: profile.accountName,
        username: profile.username,
        accountType: profile.accountType,
        pictureUrl: profile.pictureUrl || connection.pictureUrl,
        healthStatus: health.healthStatus,
        healthMessage: health.healthMessage,
        missingPermissions: health.missingPermissions,
        capabilities: { canPublish: health.canPublish },
        lastHealthCheckAt: now,
        lastSuccessfulCheckAt:
          health.canPublish ? now : connection.lastSuccessfulCheckAt || null,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  return updated || connections.findOne({ _id: objectId });
}

export async function refreshSocialConnectionHealth(id, { forceYouTubeRefresh = false } = {}) {
  const objectId = toObjectId(id);

  if (!objectId) return null;

  const { connections } = await connectionCollections();
  const connection = await connections.findOne({ _id: objectId });

  if (!connection) return null;
  if (forceYouTubeRefresh && connection.platform !== "youtube") {
    throw new TypeError("Manual token refresh is available only for YouTube channels.");
  }

  const now = new Date();

  try {
    let updated;

    if (connection.platform === GOOGLE_BUSINESS_PLATFORM) {
      updated = await refreshGoogleBusinessConnectionHealth(connections, connection, objectId, now);
    } else if (connection.platform === "youtube") {
      updated = await refreshYouTubeConnectionHealth(connections, connection, objectId, now, forceYouTubeRefresh);
    } else if (connection.platform === "linkedin") {
      updated = await refreshLinkedInConnectionHealth(
        connections, connection, objectId, now,
      );
    } else if (connection.platform === "instagram") {
      updated = await refreshInstagramConnectionHealth(
        connections,
        connection,
        objectId,
        now,
      );
    } else if (connection.platform === "facebook") {
      updated = await refreshFacebookConnectionHealth(
        connections,
        connection,
        objectId,
        now,
      );
    } else {
      throw new TypeError(`Unsupported social platform: ${connection.platform || "unknown"}`);
    }

    return updated ? serializeDocument(removeEncryptedToken(updated)) : null;
  } catch (error) {
    const expired = (error instanceof GoogleBusinessApiError && error.reason === "authorization") ||
      error?.details?.code === 190 ||
      error?.details?.status === 401 ||
      /expired|invalid.*token/i.test(error?.message || "");
    const providerName = connection.platform === GOOGLE_BUSINESS_PLATFORM ? "Google Business Profile" : connection.platform === "youtube" ? "YouTube" : connection.platform === "linkedin" ? "LinkedIn" : connection.platform === "instagram" ? "Instagram" : "Facebook";
    const subject = connection.platform === "facebook" ? "Page" : "account";
    const updated = await connections.findOneAndUpdate(
      { _id: objectId, tokenEncrypted: connection.tokenEncrypted },
      {
        $set: {
          healthStatus: expired ? "expired" : "api_error",
          healthMessage: connection.platform === GOOGLE_BUSINESS_PLATFORM && error instanceof GoogleBusinessApiError
            ? error.message : expired
            ? `${providerName} authorization has expired. Reconnect this ${subject}.`
            : `${providerName} could not verify this ${subject} connection.`,
          capabilities: { canPublish: false },
          lastHealthCheckAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    const current = updated || (await connections.findOne({ _id: objectId }));
    return current ? serializeDocument(removeEncryptedToken(current)) : null;
  }
}

export async function deleteSocialConnection(id) {
  const objectId = toObjectId(id);

  if (!objectId) return null;

  const { connections } = await connectionCollections();
  const connection = await connections.findOneAndDelete({ _id: objectId });

  return connection
    ? serializeDocument(removeEncryptedToken(connection))
    : null;
}

export async function getSocialConnectionCounts() {
  const { connections } = await connectionCollections();
  const [connected, needsAttention] = await Promise.all([
    connections.countDocuments({}),
    connections.countDocuments({
      healthStatus: { $ne: "healthy" },
    }),
  ]);

  return { connected, needsAttention };
}
