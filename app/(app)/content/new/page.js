import Link from "next/link";
import EmptyState from "@/components/empty-state";
import MasterContentForm from "@/components/master-content-form";
import PageHeader from "@/components/page-header";
import styles from "@/components/ui.module.css";
import { listClients } from "@/lib/data";

export const metadata = { title: "Create Content" };
export const dynamic = "force-dynamic";

export default async function CreateContentPage() {
  const clients = await listClients({ includeInactive: false });

  return (
    <>
      <PageHeader
        eyebrow="New package"
        title="Create Content"
        description="Start with shared source material. Platform-specific versions will inherit these defaults when social connections are added."
      />
      {clients.length ? (
        <MasterContentForm clients={clients} />
      ) : (
        <EmptyState
          title="Add a client first"
          description="Every Master Content package belongs to a client so media and future social connections remain correctly separated."
        >
          <Link className={styles.button} href="/clients">
            Add Client
          </Link>
        </EmptyState>
      )}
    </>
  );
}
