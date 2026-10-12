import { notFound } from "next/navigation";
import ContentComposer from "@/components/content-composer";
import PageHeader from "@/components/page-header";
import { getDestinationScheduleState } from "@/lib/scheduling";
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
  const scheduleEntries = await Promise.all(
    platformVersions
      .filter((version) => version.active !== false)
      .map(async (version) => {
        try {
          return [version._id, await getDestinationScheduleState(version._id)];
        } catch {
          return [version._id, { stateCode: "unavailable" }];
        }
      }),
  );
  const scheduleStates = Object.fromEntries(scheduleEntries);
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
        description="Choose your accounts, customize each post, and preview it before publishing."
      />
      <ContentComposer
        content={content}
        clients={clients}
        masterContent={masterContent}
        destinations={destinations}
        platformVersions={platformVersions}
        scheduleStates={scheduleStates}
      />
    </>
  );
}
