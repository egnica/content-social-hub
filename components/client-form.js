"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/ui.module.css";

const blankState = {
  name: "",
  website: "",
  timezone: "America/Chicago",
  approvalReportEmail: "",
  status: "active",
};

export default function ClientForm({ client = null }) {
  const router = useRouter();
  const [form, setForm] = useState(() =>
    client
      ? {
          name: client.name || "",
          website: client.website || "",
          timezone: client.timezone || "America/Chicago",
          approvalReportEmail: client.approvalReportEmail || "",
          status: client.status || "active",
        }
      : blankState,
  );
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setErrors({});

    try {
      const response = await fetch(client ? `/api/clients/${client._id}` : "/api/clients", {
        method: client ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (!response.ok) {
        setErrors(result.errors || {});
        throw new Error(result.error || "Unable to save the client.");
      }

      if (!client) setForm(blankState);
      setMessage(`${result.client.name} was ${client ? "updated" : "added"}.`);
      router.refresh();
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setPending(false);
    }
  }

  async function deleteClient() {
    if (!client) return;

    const confirmed = window.confirm(
      `Delete "${client.name}"?\n\nThis permanently deletes the client record. It will be blocked if the client has saved Content or connected social accounts.`,
    );

    if (!confirmed) return;

    setDeleting(true);
    setMessage("");
    setErrors({});

    try {
      const response = await fetch(`/api/clients/${client._id}`, { method: "DELETE" });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete the client.");
      }

      router.push("/clients");
      router.refresh();
    } catch (requestError) {
      setErrors({ delete: requestError.message });
      setMessage(requestError.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form className={styles.formCard} onSubmit={submit}>
      <div className={styles.sectionHeader}>
        <h2>{client ? "Client details" : "Add a client"}</h2>
        <p>Only the fields needed for publishing, approvals, and reports.</p>
      </div>

      {message ? (
        <div className={Object.keys(errors).length ? styles.errorNotice : styles.successNotice}>
          {message}
        </div>
      ) : null}

      <div className={styles.fieldGrid}>
        <label className={styles.fieldFull}>
          <span className={styles.label}>Client name</span>
          <input
            className={styles.input}
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            required
          />
          {errors.name ? <span className={styles.fieldError}>{errors.name}</span> : null}
        </label>

        <label className={styles.fieldFull}>
          <span className={styles.label}>Website</span>
          <input
            className={styles.input}
            type="url"
            placeholder="https://example.com"
            value={form.website}
            onChange={(event) => update("website", event.target.value)}
          />
          {errors.website ? <span className={styles.fieldError}>{errors.website}</span> : null}
        </label>

        <label className={styles.fieldFull}>
          <span className={styles.label}>Approval / report email</span>
          <input
            className={styles.input}
            type="email"
            value={form.approvalReportEmail}
            onChange={(event) => update("approvalReportEmail", event.target.value)}
          />
          {errors.approvalReportEmail ? (
            <span className={styles.fieldError}>{errors.approvalReportEmail}</span>
          ) : null}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Timezone</span>
          <select
            className={styles.select}
            value={form.timezone}
            onChange={(event) => update("timezone", event.target.value)}
          >
            <option value="America/Chicago">America/Chicago</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Denver">America/Denver</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Status</span>
          <select
            className={styles.select}
            value={form.status}
            onChange={(event) => update("status", event.target.value)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>

      <div className={styles.formActions}>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? "Saving client" : client ? "Save Changes" : "Add Client"}
        </button>
      </div>
      {client ? (
        <section className={styles.dangerZone}>
          <div>
            <strong>Delete client</strong>
            <p>
              Permanently deletes this client only when it has no saved Content or
              connected social accounts. Use Inactive status to archive a client
              and preserve its history.
            </p>
          </div>
          <button
            className={styles.buttonDangerStrong}
            type="button"
            onClick={deleteClient}
            disabled={pending || deleting}
          >
            {deleting ? "Deleting Client" : "Delete Client"}
          </button>
        </section>
      ) : null}
    </form>
  );
}
