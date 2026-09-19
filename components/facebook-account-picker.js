"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/components/ui.module.css";

function DiagnosticList({ values }) {
  if (!values?.length) return <span>None returned</span>;
  return <span>{values.join(", ")}</span>;
}

function FacebookDiagnostics({ diagnostics }) {
  if (!diagnostics) return null;

  const grantedPermissions = diagnostics.permissionStatuses
    ?.filter((item) => item.status === "granted")
    .map((item) => item.permission);
  const nonGrantedPermissions = diagnostics.permissionStatuses
    ?.filter((item) => item.status !== "granted")
    .map((item) => `${item.permission} (${item.status})`);
  const errors = [
    ["Permission check", diagnostics.permissionsError],
    ["Page listing", diagnostics.pagesError],
    ["Token inspection", diagnostics.tokenInspectionError],
    ...(diagnostics.targetedPagesErrors || []).map((error) => [
      `Selected Page ${error.pageId}`,
      error,
    ]),
  ].filter(([, error]) => error);

  return (
    <details className={styles.facebookDiagnostics} open={!diagnostics.pageCount}>
      <summary>Facebook connection diagnostics</summary>
      <dl>
        <div>
          <dt>Requested</dt>
          <dd><DiagnosticList values={diagnostics.requestedPermissions} /></dd>
        </div>
        <div>
          <dt>Granted</dt>
          <dd><DiagnosticList values={grantedPermissions} /></dd>
        </div>
        {nonGrantedPermissions?.length ? (
          <div>
            <dt>Not granted</dt>
            <dd><DiagnosticList values={nonGrantedPermissions} /></dd>
          </div>
        ) : null}
        <div>
          <dt>Token scopes</dt>
          <dd><DiagnosticList values={diagnostics.tokenScopes} /></dd>
        </div>
        <div>
          <dt>Token valid</dt>
          <dd>
            {diagnostics.tokenIsValid === null
              ? "Unknown"
              : diagnostics.tokenIsValid
                ? "Yes"
                : "No"}
          </dd>
        </div>
        <div>
          <dt>Selected Page targets</dt>
          <dd>{diagnostics.granularPageTargetCount ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Page source</dt>
          <dd>
            {diagnostics.pageDiscoveryMethod === "granular_scopes"
              ? "Meta selected Pages"
              : diagnostics.pageDiscoveryMethod === "me/accounts"
                ? "Managed Pages list"
                : "None"}
          </dd>
        </div>
        <div>
          <dt>Pages returned</dt>
          <dd>{diagnostics.pageCount}</dd>
        </div>
      </dl>
      {errors.map(([label, diagnosticError]) => (
        <div className={styles.facebookDiagnosticError} key={label}>
          <strong>{label}:</strong> {diagnosticError.message}
          {diagnosticError.code !== null
            ? ` (code ${diagnosticError.code}${
                diagnosticError.subcode !== null
                  ? `, subcode ${diagnosticError.subcode}`
                  : ""
              })`
            : ""}
          {diagnosticError.traceId
            ? ` Trace: ${diagnosticError.traceId}`
            : ""}
        </div>
      ))}
    </details>
  );
}

export default function FacebookAccountPicker({
  token,
  flow,
}) {
  const [selected, setSelected] = useState(
    flow.candidates.length === 1
      ? flow.candidates[0].providerAccountId
      : "",
  );
  const [pending, setPending] = useState(false);
  const [connection, setConnection] = useState(null);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();

    if (!selected) {
      setError("Choose the Facebook Page that belongs to this client.");
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/connections/facebook/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          providerAccountId: selected,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save this Facebook Page.");
      }

      setConnection(result.connection);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  if (connection) {
    return (
      <div className={styles.loginCard}>
        <span className={styles.brandMark}>CS</span>
        <h1>Facebook Page connected</h1>
        <p>
          <strong>{connection.accountName}</strong> is now connected to{" "}
          {flow.clientName}. Account Health is currently{" "}
          {connection.healthStatus.replaceAll("_", " ")}.
        </p>
        {flow.mode === "owner" ? (
          <Link
            className={styles.button}
            href={`/connections?clientId=${flow.clientId}`}
          >
            Return to Social Accounts
          </Link>
        ) : (
          <div className={styles.successNotice}>
            Setup is complete. You can safely close this page.
          </div>
        )}
      </div>
    );
  }

  return (
    <form className={styles.loginCard} onSubmit={submit}>
      <span className={styles.brandMark}>CS</span>
      <h1>Choose the correct Page</h1>
      <p>
        Facebook returned the Pages available to this account. Select the one
        that belongs to <strong>{flow.clientName}</strong>.
      </p>

      {error ? <div className={styles.errorNotice}>{error}</div> : null}

      {flow.candidates.length ? (
        <div className={styles.accountPickerList}>
          {flow.candidates.map((candidate) => (
            <label className={styles.accountPickerItem} key={candidate.providerAccountId}>
              <input
                type="radio"
                name="facebookPage"
                value={candidate.providerAccountId}
                checked={selected === candidate.providerAccountId}
                onChange={(event) => setSelected(event.target.value)}
              />
              <span
                className={styles.connectionAvatar}
                style={
                  candidate.pictureUrl
                    ? { backgroundImage: `url("${candidate.pictureUrl}")` }
                    : undefined
                }
                aria-hidden="true"
              >
                {!candidate.pictureUrl
                  ? candidate.accountName.slice(0, 1).toUpperCase()
                  : null}
              </span>
              <span>
                <strong>{candidate.accountName}</strong>
                <small>Facebook Page</small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <div className={styles.errorNotice}>
          Facebook authorized the connection but did not return an eligible
          Page. The diagnostics below show what Meta returned.
        </div>
      )}

      <FacebookDiagnostics diagnostics={flow.diagnostics} />

      <button
        className={styles.button}
        type="submit"
        disabled={pending || !flow.candidates.length}
      >
        {pending ? "Connecting Page" : "Connect Selected Page"}
      </button>
    </form>
  );
}
