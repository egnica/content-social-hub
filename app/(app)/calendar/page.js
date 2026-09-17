import PlaceholderPage from "@/components/placeholder-page";

export const metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <PlaceholderPage
      eyebrow="Level 6"
      title="Calendar"
      description="The native publishing calendar becomes active after the first social adapter and scheduling engine are proven."
      cards={[
        { phase: "Planned", title: "Month View", description: "See destination-specific releases across every client." },
        { phase: "Planned", title: "Week View", description: "Inspect timing and platform distribution in detail." },
        { phase: "Planned", title: "List View", description: "Filter by client, platform, and publishing status." },
      ]}
    />
  );
}
