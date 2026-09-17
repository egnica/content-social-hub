import Link from "next/link";
import EmptyState from "@/components/empty-state";
import PageHeader from "@/components/page-header";
import styles from "@/components/ui.module.css";
import { listClients, listContent } from "@/lib/data";
import { formatDate, sentenceCase } from "@/lib/format";

export const metadata = { title: "Content" };
export const dynamic = "force-dynamic";

export default async function ContentPage({ searchParams }) {
  const filters = await searchParams;
  const clientId = filters?.client || "";
  const reusable = filters?.reusable === "true";
  const [clients, content] = await Promise.all([
    listClients({ includeInactive: false }),
    listContent({ clientId, reusable }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Content"
        description="The operational home for existing Master Content packages. Create Content remains a separate action."
        actions={
          <Link className={styles.button} href="/content/new">
            + Create Content
          </Link>
        }
      />

      <div className={styles.filters}>
        <Link
          className={`${styles.filterLink} ${!clientId && !reusable ? styles.filterLinkActive : ""}`}
          href="/content"
        >
          All Content
        </Link>
        <Link
          className={`${styles.filterLink} ${reusable ? styles.filterLinkActive : ""}`}
          href="/content?reusable=true"
        >
          Reusable
        </Link>
        {clients.map((client) => (
          <Link
            className={`${styles.filterLink} ${clientId === client._id ? styles.filterLinkActive : ""}`}
            href={`/content?client=${client._id}`}
            key={client._id}
          >
            {client.name}
          </Link>
        ))}
      </div>

      {content.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Internal Title</th>
                <th>Client</th>
                <th>Status</th>
                <th>Media</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {content.map((item) => (
                <tr className={styles.tableRowLink} key={item._id}>
                  <td>
                    <Link href={`/content/${item._id}`}>
                      <strong>{item.internalTitle}</strong>
                    </Link>
                    {item.reusable ? <div className={styles.statNote}>Saved for reuse</div> : null}
                  </td>
                  <td>{item.clientName}</td>
                  <td>
                    <span className={styles.successBadge}>{sentenceCase(item.status)}</span>
                  </td>
                  <td>{item.mediaIds?.length || 0}</td>
                  <td>{formatDate(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No Master Content found"
          description="Create a content package from a URL, image, video, or source text."
        >
          <Link className={styles.button} href="/content/new">
            Create Content
          </Link>
        </EmptyState>
      )}
    </>
  );
}
