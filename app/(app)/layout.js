import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { getSession } from "@/lib/session";

export default async function AuthenticatedLayout({ children }) {
  if (!(await getSession())) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
