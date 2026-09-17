import Link from "next/link";
import ClientForm from "@/components/client-form";
import PageHeader from "@/components/page-header";
import styles from "@/components/ui.module.css";
import { listClients } from "@/lib/data";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Clients"
        description="Keep client setup lightweight. Social connections and brand intelligence are added only when needed."
      />

      <div className={styles.twoColumn}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Status</th>
                <th>Timezone</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {clients.length ? (
                clients.map((client) => (
                  <tr key={client._id}>
                    <td>
                      <strong>
                        <Link href={`/clients/${client._id}`}>{client.name}</Link>
                      </strong>
                      {client.website ? <div className={styles.statNote}>{client.website}</div> : null}
                    </td>
                    <td>
                      <span className={client.status === "active" ? styles.successBadge : styles.neutralBadge}>
                        {client.status}
                      </span>
                    </td>
                    <td>{client.timezone}</td>
                    <td>{formatDate(client.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4">No clients have been added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <ClientForm />
      </div>
    </>
  );
}
