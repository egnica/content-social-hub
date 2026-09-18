import Link from "next/link";
import { notFound } from "next/navigation";
import ClientForm from "@/components/client-form";
import PageHeader from "@/components/page-header";
import styles from "@/components/ui.module.css";
import { getClientById } from "@/lib/data";

export const metadata = { title: "Client Details" };
export const dynamic = "force-dynamic";

export default async function ClientDetailsPage({ params }) {
  const { id } = await params;
  const client = await getClientById(id);

  if (!client) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Client"
        title={client.name}
        description="Manage the lightweight client record used by content, approvals, and reporting."
        actions={
          <Link
            className={styles.buttonSecondary}
            href={`/connections?clientId=${client._id}`}
          >
            Social Accounts
          </Link>
        }
      />
      <ClientForm client={client} />
    </>
  );
}
