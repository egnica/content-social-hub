import { notFound } from "next/navigation";
import MasterContentForm from "@/components/master-content-form";
import PageHeader from "@/components/page-header";
import { getContentById, listClients } from "@/lib/data";

export const metadata = { title: "Edit Content" };
export const dynamic = "force-dynamic";

export default async function EditContentPage({ params }) {
  const { id } = await params;
  const [content, clients] = await Promise.all([
    getContentById(id),
    listClients({ includeInactive: false }),
  ]);

  if (!content) notFound();

  return (
    <>
      <PageHeader
        eyebrow={content.clientName}
        title={content.internalTitle}
        description="Edit the shared source package and media defaults. Platform-specific versions begin in Level 3."
      />
      <MasterContentForm clients={clients} content={content} />
    </>
  );
}
