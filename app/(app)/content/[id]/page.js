import { notFound } from "next/navigation";
import MasterContentForm from "@/components/master-content-form";
import PageHeader from "@/components/page-header";
import PlatformDestinationSelector from "@/components/platform-destination-selector";
import { getContentById, listClients } from "@/lib/data";
import { getPlatformDestinationState } from "@/lib/platform-versions";

export const metadata = { title: "Edit Content" };
export const dynamic = "force-dynamic";

export default async function EditContentPage({ params }) {
  const { id } = await params;
  const [content, clients] = await Promise.all([
    getContentById(id),
    listClients({ includeInactive: false }),
  ]);

  if (!content) notFound();

  const destinationState = await getPlatformDestinationState(id);

  return (
    <>
      <PageHeader
        eyebrow={content.clientName}
        title={content.internalTitle}
        description="Edit the shared source package and choose the connected destinations that will receive platform-specific versions."
      />
      <MasterContentForm clients={clients} content={content} />
      <PlatformDestinationSelector
        contentId={content._id}
        clientName={content.clientName}
        destinations={destinationState?.destinations || []}
        initialPlatformVersions={destinationState?.platformVersions || []}
      />
    </>
  );
}
