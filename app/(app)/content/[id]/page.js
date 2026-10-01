import { notFound } from "next/navigation";
import FacebookPlatformEditors from "@/components/facebook-platform-editor";
import InstagramPlatformEditors from "@/components/instagram-platform-editor";
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
  const destinations = destinationState?.destinations || [];
  const platformVersions = destinationState?.platformVersions || [];
  const masterContent = {
    _id: content._id,
    clientId: content.clientId,
    revision: content.revision,
    text: content.text,
    primaryUrl: content.primaryUrl,
    media: content.media || [],
    defaultVideoThumbnail: content.defaultVideoThumbnail || null,
    defaultReleaseAt: content.defaultReleaseAt || null,
    defaultReleaseTimezone: content.defaultReleaseTimezone || null,
    clientTimezone: content.clientTimezone || "",
  };

  return (
    <>
      <PageHeader
        eyebrow={content.clientName}
        title={content.internalTitle}
        description="Edit the shared source package, choose destinations, and customize each active platform version independently."
      />
      <MasterContentForm clients={clients} content={content} />
      <PlatformDestinationSelector
        contentId={content._id}
        clientName={content.clientName}
        destinations={destinations}
        initialPlatformVersions={platformVersions}
      />
      <FacebookPlatformEditors
        masterContent={masterContent}
        destinations={destinations}
        platformVersions={platformVersions}
      />
      <InstagramPlatformEditors
        masterContent={masterContent}
        destinations={destinations}
        platformVersions={platformVersions}
      />
    </>
  );
}
