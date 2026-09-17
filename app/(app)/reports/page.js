import PlaceholderPage from "@/components/placeholder-page";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <PlaceholderPage
      eyebrow="Level 9"
      title="Reports"
      description="On-demand reporting will use the analytics stored by the publishing adapters."
      cards={[
        { phase: "Planned", title: "Date Presets", description: "Generate 7, 30, 60, or 90-day views and custom ranges." },
        { phase: "Planned", title: "PDF Export", description: "Create a consistent client-ready report from stored data." },
        { phase: "Planned", title: "Resend Delivery", description: "Send reports to the client approval and report email." },
      ]}
    />
  );
}
