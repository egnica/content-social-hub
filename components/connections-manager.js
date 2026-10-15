"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AccountAvatar from "@/components/account-avatar";
import PlatformIcon from "@/components/platform-icon";
import styles from "@/components/ui.module.css";

function labelHealth(status) {
  return (
    {
      healthy: "Healthy",
      expiring_soon: "Expiring Soon",
      expired: "Expired",
      disconnected: "Disconnected",
      permission_problem: "Permission Problem",
      api_error: "API Error",
    }[status] || "Not checked"
  );
}

function labelConnectionPlatform(connection) {
  return connection.platform === "instagram"
    ? "Instagram Professional"
    : connection.platform === "google_business_profile" ? "Google Business Profile location"
    : connection.platform === "linkedin" ? "LinkedIn personal profile" : connection.platform === "youtube" ? "YouTube channel" : "Facebook Page";
}

function labelRequestPlatform(platform) {
  return platform === "instagram" ? "Instagram" : platform === "linkedin" ? "LinkedIn" : platform === "youtube" ? "YouTube" : "Facebook Pages";
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

function AttachedAccounts({ connections, platform }) {
  const accounts = connections.filter(connection => connection.platform === platform);
  return (
    <div className={styles.attachedAccounts}>
      <p className={styles.attachedAccountCount}>
        {accounts.length ? `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"} attached` : "No accounts connected yet"}
      </p>
      {accounts.length ? <div className={styles.accountChips}>
        {accounts.map(connection => (
          <a key={connection._id} className={styles.accountChip}
            href={`#account-${connection._id}`} title={`${connection.accountName} · ${labelHealth(connection.healthStatus)}`}
            aria-label={`${connection.accountName}, ${labelHealth(connection.healthStatus)}. View account details.`}
            onClick={() => document.getElementById(`account-${connection._id}`)?.focus({ preventScroll: true })}>
            <AccountAvatar connection={connection} small />
            <span className={styles.accountChipName}>{connection.accountName}</span>
            <span className={connection.healthStatus === "healthy" ? styles.accountChipHealthy : styles.accountChipStatus}>
              {labelHealth(connection.healthStatus)}
            </span>
          </a>
        ))}
      </div> : null}
    </div>
  );
}

export default function ConnectionsManager(props) {
  // Remount local request/health state when the server snapshot or client changes.
  const key = JSON.stringify([
    props.selectedClient?._id,
    props.initialConnections,
    props.initialRequests,
  ]);
  return <ClientConnectionsManager key={key} {...props} />;
}

function ClientConnectionsManager({
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
  const connectLabel = platform => connections.some(connection => connection.platform === platform) ? "Add account" : "Connect";

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

  async function refreshYouTubeNow(connectionId) {
    setCheckingId(connectionId);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/connections/${connectionId}/refresh-youtube`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to refresh YouTube authorization.");
      }

      setConnections((current) =>
        current.map((connection) =>
          connection._id === connectionId ? result.connection : connection,
        ),
      );

      if (!["healthy", "expiring_soon"].includes(result.connection.healthStatus)) {
        throw new Error(result.connection.healthMessage || "YouTube token refresh could not be verified.");
      }

      setMessage(`${result.connection.accountName}: YouTube access token renewed and channel identity verified.`);
    } catch (refreshError) {
      setError(refreshError.message);
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
          {message ? (
            <div className={styles.successNotice}>{message}</div>
          ) : null}

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
            <PlatformIcon platform="facebook" />
            <div className={styles.connectionProviderBody}>
              <strong>Facebook Pages</strong>
              <p>
                Connect directly when you already manage the Page, or email a
                secure 48-hour connection link to the client.
              </p>
              <AttachedAccounts connections={connections} platform="facebook" />
            </div>
            <div className={styles.connectionActions}>
              {configuration.facebookReady ? (
                <a
                  className={styles.button}
                  href={`/api/connections/facebook/start?clientId=${selectedClient._id}`}
                >
                  {connectLabel("facebook")}
                </a>
              ) : (
                <button className={styles.button} type="button" disabled>
                  {connectLabel("facebook")}
                </button>
              )}
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
            <PlatformIcon platform="instagram" />
            <div className={styles.connectionProviderBody}>
              <strong>Instagram Professional</strong>
              <p>
                Connect a Business or Creator account directly, or email the
                same secure limited-purpose setup flow to the client.
              </p>
              <AttachedAccounts connections={connections} platform="instagram" />
            </div>
            <div className={styles.connectionActions}>
              {configuration.instagramReady ? (
                <a
                  className={styles.button}
                  href={`/api/connections/instagram/start?clientId=${selectedClient._id}`}
                >
                  {connectLabel("instagram")}
                </a>
              ) : (
                <button className={styles.button} type="button" disabled>
                  {connectLabel("instagram")}
                </button>
              )}
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

          {!configuration.linkedinReady ? (
            <div className={styles.notice}>
              LinkedIn setup is waiting for these Amplify variables:{" "}
              <strong>{configuration.missingLinkedin.join(", ")}</strong>
            </div>
          ) : null}

          <article className={styles.connectionProviderCard}>
            <PlatformIcon platform="linkedin" />
            <div className={styles.connectionProviderBody}>
              <strong>LinkedIn personal profile</strong>
              <p>Connect your own profile, or email a secure 48-hour setup link. Company Pages require separate API approval.</p>
              <AttachedAccounts connections={connections} platform="linkedin" />
            </div>
            <div className={styles.connectionActions}>
              {configuration.linkedinReady ? (
                <a className={styles.button}
                  href={`/api/connections/linkedin/start?clientId=${selectedClient._id}`}>{connectLabel("linkedin")}</a>
              ) : (
                <button className={styles.button} type="button" disabled>{connectLabel("linkedin")}</button>
              )}
              <button className={styles.buttonSecondary} type="button"
                onClick={() => sendRequest("linkedin")}
                disabled={Boolean(sendingPlatform) || !configuration.linkedinReady ||
                  !configuration.emailReady || !selectedClient.approvalReportEmail}>
                {sendingPlatform === "linkedin" ? "Sending" : "Request Connection"}
              </button>
            </div>
          </article>

          {!configuration.youtubeReady ? (
            <div className={styles.notice}>YouTube setup is waiting for: <strong>{configuration.missingYoutube.join(", ")}</strong></div>
          ) : null}
          <article className={styles.connectionProviderCard}>
            <PlatformIcon platform="youtube" />
            <div className={styles.connectionProviderBody}>
              <strong>YouTube channel</strong>
              <p>Authorize Google, then confirm the exact YouTube channel. Connect directly or email a secure 48-hour setup link. No videos will be uploaded.</p>
              <AttachedAccounts connections={connections} platform="youtube" />
            </div>
            <div className={styles.connectionActions}>
              {configuration.youtubeReady ? (
                <a className={styles.button} href={`/api/connections/youtube/start?clientId=${selectedClient._id}`}>{connectLabel("youtube")}</a>
              ) : <button type="button" className={styles.button} disabled>{connectLabel("youtube")}</button>}
              <button className={styles.buttonSecondary} type="button"
                onClick={() => sendRequest("youtube")}
                disabled={Boolean(sendingPlatform) || !configuration.youtubeReady ||
                  !configuration.emailReady || !selectedClient.approvalReportEmail}>
                {sendingPlatform === "youtube" ? "Sending" : "Request Connection"}
              </button>
            </div>
          </article>
          <article className={styles.connectionProviderCard}>
            <PlatformIcon platform="google_business_profile" />
            <div className={styles.connectionProviderBody}>
              <strong>Google Business Profile</strong>
              <p>Authorize Google, then choose the exact business location. Google must approve API access for location lookup. Posting support is an upcoming step.</p>
              <AttachedAccounts connections={connections} platform="google_business_profile" />
              {!configuration.googleBusinessReady && <p className={styles.fieldHint}>
                Setup is waiting for: {(configuration.missingGoogleBusiness || ["Google Business OAuth credentials"]).join(", ")}.
              </p>}
            </div>
            <div className={styles.connectionActions}>
              {configuration.googleBusinessReady
                ? <a className={styles.button} href={`/api/connections/google-business/start?clientId=${selectedClient._id}`}>{connectLabel("google_business_profile")}</a>
                : <button className={styles.button} type="button" disabled>{connectLabel("google_business_profile")}</button>}
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
                <article className={styles.connectionItem} key={connection._id} id={`account-${connection._id}`} tabIndex={-1}>
                  <AccountAvatar connection={connection} />
                  <div className={styles.connectionIdentity}>
                    <strong>{connection.accountName}</strong>
                    <span>{labelConnectionPlatform(connection)}</span>
                    {connection.healthMessage ? (
                      <p>{connection.healthMessage}</p>
                    ) : null}
                    {connection.platform === "linkedin" && connection.tokenExpiresAt ? (
                      <p>Authorization expires {formatDate(connection.tokenExpiresAt)}</p>
                    ) : null}
                    {(connection.platform === "youtube" || connection.platform === "google_business_profile") && connection.tokenExpiresAt ? (
                      <p className={connection.platform === "google_business_profile" ? styles.connectionMetadata : undefined}>Access token expires {formatDate(connection.tokenExpiresAt)}. Check now renews it when needed.</p>
                    ) : null}
                    {connection.platform === "google_business_profile" && <>
                      <p className={styles.connectionMetadata}>{connection.address || "Service-area business or address not provided"}</p>
                      <p className={styles.connectionMetadata}>{connection.providerParent}</p>
                      <p className={styles.connectionMetadata}>Account access connected. Posting support is an upcoming step.</p>
                    </>}
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
                  <div className={styles.connectionItemActions}>
                    {connection.platform === "google_business_profile" && <a className={styles.buttonSecondary}
                      href={`/api/connections/google-business/start?clientId=${connection.clientId}&connectionId=${connection._id}`}>Reconnect</a>}
                    {connection.platform === "youtube" && (
                      <button
                        className={styles.buttonSecondary}
                        type="button"
                        onClick={() => refreshYouTubeNow(connection._id)}
                        disabled={checkingId === connection._id}
                      >
                        {checkingId === connection._id ? "Refreshing" : "Refresh token now"}
                      </button>
                    )}
                    {connection.platform === "youtube" && (
                      <a className={styles.buttonSecondary}
                        href={`/api/connections/youtube/start?clientId=${connection.clientId}&connectionId=${connection._id}`}>Reconnect</a>
                    )}
                    {connection.platform === "linkedin" && (
                      <a className={styles.buttonSecondary}
                        href={`/api/connections/linkedin/start?clientId=${connection.clientId}&connectionId=${connection._id}`}>
                        Reconnect
                      </a>
                    )}
                    <button
                      className={styles.buttonGhost}
                      type="button"
                      onClick={() => checkHealth(connection._id)}
                      disabled={checkingId === connection._id}
                    >
                      {checkingId === connection._id ? "Checking" : "Check now"}
                    </button>
                  </div>
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
