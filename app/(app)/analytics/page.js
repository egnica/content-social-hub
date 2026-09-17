import PlaceholderPage from "@/components/placeholder-page";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <PlaceholderPage
      eyebrow="Level 8"
      title="Analytics"
      description="Native platform metrics and website attribution follow successful end-to-end publishing."
      cards={[
        { phase: "Planned", title: "Native Metrics", description: "Keep each network's reach, views, and engagement definitions intact." },
        { phase: "Planned", title: "Audience Growth", description: "Track follower and subscriber change by client and destination." },
        { phase: "Planned", title: "Website Attribution", description: "Connect generated UTM values to GA4 traffic and outcomes." },
      ]}
    />
  );
}
