import PlaceholderPage from "@/components/placeholder-page";

export const metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <PlaceholderPage
      eyebrow="Level 6"
      title="Calendar"
      description="Schedule posts from their account tabs in Content. A shared publishing calendar will be available here later."
      cards={[
        { phase: "Planned", title: "Month View", description: "See destination-specific releases across every client." },
        { phase: "Planned", title: "Week View", description: "Inspect timing and platform distribution in detail." },
        { phase: "Planned", title: "List View", description: "Filter by client, platform, and publishing status." },
      ]}
    />
  );
}
