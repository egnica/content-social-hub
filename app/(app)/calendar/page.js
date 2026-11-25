import Link from "next/link";
import PageHeader from "@/components/page-header";
import CalendarClientSelector from "@/components/calendar-client-selector";
import CalendarBulkPreview from "@/components/calendar-bulk-preview";
import styles from "@/components/ui.module.css";
import { listClients } from "@/lib/data";
import { listSocialConnections } from "@/lib/connections";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }) {
  const params = await searchParams;
  const clients = await listClients();
  const selectedClient = clients.find((client) => client._id === params?.client) || null;
  const connections = selectedClient?.status === "active" ? await listSocialConnections({ clientId: selectedClient._id }) : [];
  const accounts = connections.filter((connection) => connection.clientId === selectedClient?._id).map((connection) => ({
    id: connection._id,
    name: connection.accountName,
    platform: connection.platform,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Workflow + Calendar"
        title="Calendar"
        description="Schedule posts from their account tabs in Content. A shared publishing calendar will be available here later."
        backHref="/"
        backLabel="Dashboard"
      />

      <div className={styles.calendarClientFilter}>
        <CalendarClientSelector clients={clients} selectedClientId={selectedClient?._id || ""} />
        <p className={styles.statNote}>
          {selectedClient ? `Selected client: ${selectedClient.name}. ` : "Viewing All Clients. "}
          <Link href={selectedClient ? `/content?client=${selectedClient._id}` : "/content"}>
            View {selectedClient ? `${selectedClient.name}'s` : "all"} content
          </Link> to manage schedules.
        </p>
      </div>

      <CalendarBulkPreview key={selectedClient?._id || "all"} client={selectedClient?.status === "active" ? { id: selectedClient._id, name: selectedClient.name, timezone: selectedClient.timezone } : null} accounts={accounts} draftImportEnabled={process.env.BULK_DRAFT_WRITES_ENABLED === "true"} scheduleEnabled={process.env.BULK_SCHEDULE_WRITES_ENABLED === "true"} />

      <div className={styles.placeholderGrid}>
        <article className={styles.placeholderCard}>
          <span className={styles.eyebrow}>Planned</span>
          <h2>Month View</h2>
          <p>See destination-specific releases across {selectedClient ? selectedClient.name : "every client"}.</p>
        </article>
        <article className={styles.placeholderCard}>
          <span className={styles.eyebrow}>Planned</span>
          <h2>Week View</h2>
          <p>Inspect timing and platform distribution in detail.</p>
        </article>
        <article className={styles.placeholderCard}>
          <span className={styles.eyebrow}>Planned</span>
          <h2>List View</h2>
          <p>Filter by client, platform, and publishing status.</p>
        </article>
      </div>
    </>
  );
}
