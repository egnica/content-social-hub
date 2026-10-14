import DashboardOverview from "@/components/dashboard-overview";
import { getDashboardData } from "@/lib/data";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return <DashboardOverview dashboard={await getDashboardData()} />;
}
