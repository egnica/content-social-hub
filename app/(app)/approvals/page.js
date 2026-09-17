import PlaceholderPage from "@/components/placeholder-page";

export const metadata = { title: "Approvals" };

export default function ApprovalsPage() {
  return (
    <PlaceholderPage
      eyebrow="Level 7"
      title="Approvals"
      description="Approval belongs to a specific platform revision and will be introduced after scheduling is reliable."
      cards={[
        { phase: "Planned", title: "Secure Review", description: "Clients review destination previews without receiving an app account." },
        { phase: "Planned", title: "Request Edits", description: "Comments appear directly beside the platform version that needs work." },
        { phase: "Planned", title: "Audit History", description: "Preserve the approved and published revision for every destination." },
      ]}
    />
  );
}
