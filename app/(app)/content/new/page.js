import Link from "next/link";
import EmptyState from "@/components/empty-state";
import MasterContentForm from "@/components/master-content-form";
import PageHeader from "@/components/page-header";
import styles from "@/components/ui.module.css";
import { getContentById, listClients } from "@/lib/data";
import { notFound } from "next/navigation";

export const metadata = { title: "Create Content" };
export const dynamic = "force-dynamic";

export default async function CreateContentPage({ searchParams }) {
  const query = await searchParams;
  const [clients, sourceContent] = await Promise.all([
    listClients({ includeInactive: false }),
    query?.from ? getContentById(query.from) : Promise.resolve(null),
  ]);
  if (query?.from && !sourceContent) notFound();

  return (
    <>
      <PageHeader
        backHref="/content" backLabel="Content"
        eyebrow="New package"
        title="Create Content"
        description="Choose a client and add your text, link, or media. Save it, then choose the accounts to post to."
      />
      {clients.length ? (
        <MasterContentForm clients={clients} sourceContent={sourceContent} initialClientId={query?.client} />
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
