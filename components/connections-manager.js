"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/ui.module.css";

function labelHealth(status) {
  return {
    healthy: "Healthy",
    expiring_soon: "Expiring Soon",
    expired: "Expired",
    disconnected: "Disconnected",
    permission_problem: "Permission Problem",
    api_error: "API Error",
  }[status] || "Not checked";
}

function labelConnectionPlatform(connection) {
  return connection.platform === "instagram"
    ? "Instagram Professional"
    : "Facebook Page";
}

function labelRequestPlatform(platform) {
  return platform === "instagram" ? "Instagram" : "Facebook Pages";
}

function formatRequestPlatforms(request) {
  return (request.requestedPlatforms || ["facebook"])
    .map((platform) => {
      const state = request.platformStatus?.[platform];
      return state === "connected"
        ? `${labelRequestPlatform(platform)} connected`
        : labelRequestPlatform(platform);
    })
    .join(" · ");
}

function requestOverlapsPlatform(request, platform) {
  return (request.requestedPlatforms || ["facebook"]).includes(platform);
}

function formatDate(value) {
  if (!value) return "Not yet";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ConnectionsManager({
  clients,
  selectedClient,
  initialConnections,
  initialRequests,
  configuration,
}) {
  const router = useRouter();
  const [connections, setConnections] = useState(initialConnections);
  const [requests, setRequests] = useState(initialRequests);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sendingPlatform, setSendingPlatform] = useState("");
  const [checkingId, setCheckingId] = useState("");

  useEffect(() => {
    setConnections(initialConnections);
    setRequests(initialRequests);
    setMessage("");
    setError("");
    setSendingPlatform("");
  }, [initialConnections, initialRequests, selectedClient?._id]);

  function changeClient(event) {
    const clientId = event.target.value;
    router.push(clientId ? `/connections?clientId=${clientId}` : "/connections");
  }

  async function sendRequest(platform) {
    if (!selectedClient) return;

    setSendingPlatform(platform);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/connection-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient._id,
          requestedPlatforms: [platform],
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to send the connection request.");
      }

      setRequests((current) => [
        result.request,
        ...current.map((request) =>
          ["pending", "email_failed"].includes(request.status) &&
          requestOverlapsPlatform(request, platform)
            ? { ...request, status: "revoked" }
            : request,
        ),
      ]);
      setMessage(
        `${labelRequestPlatform(platform)} connection request sent to ${result.request.email}. The link expires in 48 hours.`,
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSendingPlatform("");
    }
  }

  async function checkHealth(connectionId) {
    setCheckingId(connectionId);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/connections/${connectionId}/health`,
        { method: "POST" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to check this connection.");
      }

      setConnections((current) =>
        current.map((connection) =>
          connection._id === connectionId ? result.connection : connection,
        ),
      );
      setMessage(
        `${result.connection.accountName} is ${labelHealth(result.connection.healthStatus).toLowerCase()}.`,
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCheckingId("");
    }
  }

  if (!clients.length) {
    return (
      <div className={styles.emptyState}>
        <div>
          <h2>Add a client first</h2>
          <p>Social accounts are always connected to a specific client.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.connectionLayout}>
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Client</h2>
            <p className={styles.statNote}>
              Choose who owns the destination account.
            </p>
          </div>
          <select
            className={styles.select}
            value={selectedClient?._id || ""}
            onChange={changeClient}
            aria-label="Choose client"
          >
            {clients.map((client) => (
              <option value={client._id} key={client._id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.panelBody}>
          {error ? <div className={styles.errorNotice}>{error}</div> : null}
          {message ? <div className={styles.successNotice}>{message}</div> : null}

          {!configuration.facebookReady ? (
            <div className={styles.notice}>
              Facebook setup is waiting for these Amplify variables:{" "}
              <strong>{configuration.missingFacebook.join(", ")}</strong>
            </div>
          ) : null}
          {!configuration.instagramReady ? (
            <div className={styles.notice}>
              Instagram setup is waiting for these Amplify variables:{" "}
              <strong>{configuration.missingInstagram.join(", ")}</strong>
            </div>
          ) : null}

          <article className={styles.connectionProviderCard}>
            <div className={styles.providerMark}>f</div>
            <div className={styles.connectionProviderBody}>
              <strong>Facebook Pages</strong>
              <p>
                Connect directly when you already manage the Page, or email a
                secure 48-hour connection link to the client.
              </p>
            </div>
            <div className={styles.connectionActions}>
              <button
                className={styles.button}
                type="button"
                disabled={!configuration.facebookReady}
                onClick={() =>
                  window.location.assign(
                    `/api/connections/facebook/start?clientId=${selectedClient._id}`,
                  )
                }
              >
                Connect
              </button>
              <button
                className={styles.buttonSecondary}
                type="button"
                onClick={() => sendRequest("facebook")}
                disabled={
                  Boolean(sendingPlatform) ||
                  !configuration.facebookReady ||
                  !configuration.emailReady ||
                  !selectedClient.approvalReportEmail
                }
              >
                {sendingPlatform === "facebook" ? "Sending" : "Request Connection"}
              </button>
            </div>
          </article>

          <article className={styles.connectionProviderCard}>
            <div className={styles.providerMark}>ig</div>
            <div className={styles.connectionProviderBody}>
              <strong>Instagram Professional</strong>
              <p>
                Connect a Business or Creator account directly, or email the
                same secure limited-purpose setup flow to the client.
              </p>
            </div>
            <div className={styles.connectionActions}>
              <button
                className={styles.button}
                type="button"
                disabled={!configuration.instagramReady}
                onClick={() =>
                  window.location.assign(
                    `/api/connections/instagram/start?clientId=${selectedClient._id}`,
                  )
                }
              >
                Connect
              </button>
              <button
                className={styles.buttonSecondary}
                type="button"
                onClick={() => sendRequest("instagram")}
                disabled={
                  Boolean(sendingPlatform) ||
                  !configuration.instagramReady ||
                  !configuration.emailReady ||
                  !selectedClient.approvalReportEmail
                }
              >
                {sendingPlatform === "instagram" ? "Sending" : "Request Connection"}
              </button>
            </div>
          </article>

          {!selectedClient.approvalReportEmail ? (
            <p className={styles.fieldHint}>
              Add an Approval / Report Email to this client before requesting
              social account access by email.
            </p>
          ) : null}
          {!configuration.emailReady ? (
            <p className={styles.fieldHint}>
              Resend email is waiting for:{" "}
              {configuration.missingEmail.join(", ")}.
            </p>
          ) : null}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Connected accounts</h2>
            <p className={styles.statNote}>
              Account Health stays quiet until a connection needs attention.
            </p>
          </div>
        </div>
        <div className={styles.panelBody}>
          {connections.length ? (
            <div className={styles.connectionList}>
              {connections.map((connection) => (
                <article className={styles.connectionItem} key={connection._id}>
                  <div
                    className={styles.connectionAvatar}
                    style={
                      connection.pictureUrl
                        ? { backgroundImage: `url("${connection.pictureUrl}")` }
                        : undefined
                    }
                    aria-hidden="true"
                  >
                    {!connection.pictureUrl
                      ? connection.accountName.slice(0, 1).toUpperCase()
                      : null}
                  </div>
                  <div className={styles.connectionIdentity}>
                    <strong>{connection.accountName}</strong>
                    <span>{labelConnectionPlatform(connection)}</span>
                    {connection.healthMessage ? (
                      <p>{connection.healthMessage}</p>
                    ) : null}
                  </div>
                  <div className={styles.connectionHealth}>
                    <span
                      className={
                        connection.healthStatus === "healthy"
                          ? styles.successBadge
                          : styles.statusBadge
                      }
                    >
                      {labelHealth(connection.healthStatus)}
                    </span>
                    <span>
                      Checked {formatDate(connection.lastHealthCheckAt)}
                    </span>
                  </div>
                  <button
                    className={styles.buttonGhost}
                    type="button"
                    onClick={() => checkHealth(connection._id)}
                    disabled={checkingId === connection._id}
                  >
                    {checkingId === connection._id ? "Checking" : "Check now"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.notice}>
              No social accounts are connected to this client yet.
            </div>
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Connection requests</h2>
            <p className={styles.statNote}>
              A new request replaces older unfinished links for the same network.
            </p>
          </div>
        </div>
        <div className={styles.panelBody}>
          {requests.length ? (
            <div className={styles.requestList}>
              {requests.map((request) => (
                <div className={styles.requestItem} key={request._id}>
                  <div>
                    <strong>{request.email}</strong>
                    <p>
                      {formatRequestPlatforms(request)} · Expires{" "}
                      {formatDate(request.expiresAt)}
                    </p>
                  </div>
                  <span
                    className={
                      request.status === "completed"
                        ? styles.successBadge
                        : request.status === "pending"
                          ? styles.statusBadge
                          : styles.neutralBadge
                    }
                  >
                    {request.status.replaceAll("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.notice}>
              No connection requests have been sent for this client.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
