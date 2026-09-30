import ConnectionsManager from "@/components/connections-manager";
import PageHeader from "@/components/page-header";
import {
  getPhase2ConfigurationStatus,
  listConnectionRequests,
  listSocialConnections,
} from "@/lib/connections";
import { listClients } from "@/lib/data";

export const metadata = { title: "Social Accounts" };
export const dynamic = "force-dynamic";

export default async function ConnectionsPage({ searchParams }) {
  const params = await searchParams;
  const clients = await listClients();
  const selectedClient =
    clients.find((client) => client._id === params?.clientId) ||
    clients[0] ||
    null;
  const [connections, requests] = selectedClient
    ? await Promise.all([
        listSocialConnections({ clientId: selectedClient._id }),
        listConnectionRequests({ clientId: selectedClient._id }),
      ])
    : [[], []];

  return (
    <>
      <PageHeader
        eyebrow="Level 5"
        title="Social Accounts"
        description="Connect the exact Facebook or Instagram destination to the correct client. Passwords stay with the social provider and are never collected by this application."
      />
      <ConnectionsManager
        clients={clients}
        selectedClient={selectedClient}
        initialConnections={connections}
        initialRequests={requests}
        configuration={getPhase2ConfigurationStatus()}
      />
    </>
  );
}
