"use client";

import styles from "@/components/ui.module.css";

export default function CalendarClientSelector({ clients, selectedClientId }) {
  return (
    <form action="/calendar" method="get">
      <label className={styles.label} htmlFor="calendar-client">Client</label>
      <select
        className={styles.select}
        id="calendar-client"
        name="client"
        defaultValue={selectedClientId}
        onChange={(event) => event.currentTarget.form.requestSubmit()}
      >
        <option value="">All Clients</option>
        {clients.map((client) => (
          <option key={client._id} value={client._id}>{client.name}</option>
        ))}
      </select>
      <noscript><button type="submit">Show client</button></noscript>
    </form>
  );
}
