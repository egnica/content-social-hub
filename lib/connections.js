import "server-only";

import { ObjectId } from "mongodb";
import {
  checkFacebookPage,
  getFacebookRequiredPermissions,
  inspectFacebookToken,
} from "@/lib/facebook";
import { getDb } from "@/lib/mongodb";
import { serializeDocument, toObjectId } from "@/lib/ids";
import {
  createSecureToken,
  decryptSecret,
  encryptSecret,
  hashSecureToken,
} from "@/lib/secure-values";

const REQUEST_DURATION_MS = 48 * 60 * 60 * 1000;
const OAUTH_STATE_DURATION_MS = 10 * 60 * 1000;
const SELECTION_DURATION_MS = 20 * 60 * 1000;

function removeEncryptedToken(document) {
  const safeDocument = { ...document };
  delete safeDocument.tokenEncrypted;
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
  const required = [
    "META_APP_ID",
    "META_APP_SECRET",
    "APP_BASE_URL",
    "OAUTH_TOKEN_ENCRYPTION_KEY",
  ];
  const missingFacebook = required.filter(
    (name) => !process.env[name]?.trim(),
  );
  const missingEmail = ["RESEND_API_KEY", "EMAIL_FROM"].filter(
    (name) => !process.env[name]?.trim(),
  );

  return {
    facebookReady: missingFacebook.length === 0,
    emailReady: missingEmail.length === 0,
    missingFacebook,
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

export async function createConnectionRequest(clientId) {
  const clientObjectId = toObjectId(clientId);

  if (!clientObjectId) {
    throw new TypeError("Choose a valid client.");
  }

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
    requestedPlatforms: ["facebook"],
    platformStatus: { facebook: "requested" },
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

  if (request.expiresAt <= now && status !== "completed") {
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
  const now = new Date();
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

  if (flow.requestId) {
    await requests.updateOne(
      { _id: flow.requestId },
      {
        $set: {
          "platformStatus.facebook": "connected",
          status: "completed",
          completedAt: now,
          updatedAt: now,
        },
      },
    );
  }

  return serializeDocument(removeEncryptedToken(connection));
}

export async function refreshSocialConnectionHealth(id) {
  const objectId = toObjectId(id);

  if (!objectId) return null;

  const { connections } = await connectionCollections();
  const connection = await connections.findOne({ _id: objectId });

  if (!connection) return null;

  const now = new Date();

  try {
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

    const updated = await connections.findOneAndUpdate(
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
    return serializeDocument(removeEncryptedToken(updated));
  } catch (error) {
    const expired =
      error?.details?.code === 190 ||
      /expired|invalid.*token/i.test(error?.message || "");
    const updated = await connections.findOneAndUpdate(
      { _id: objectId },
      {
        $set: {
          healthStatus: expired ? "expired" : "api_error",
          healthMessage: expired
            ? "Facebook authorization has expired. Reconnect this Page."
            : "Facebook could not verify this Page connection.",
          lastHealthCheckAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    return serializeDocument(removeEncryptedToken(updated));
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
