import Link from "next/link";
import PageHeader from "@/components/page-header";
import CalendarClientSelector from "@/components/calendar-client-selector";
import styles from "@/components/ui.module.css";
import { listClients } from "@/lib/data";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }) {
  const params = await searchParams;
  const clients = await listClients();
  const selectedClient = clients.find((client) => client._id === params?.client) || null;

  return (
    <>
      <PageHeader
        eyebrow="Coming later"
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
