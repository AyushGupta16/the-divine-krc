import { createFileRoute } from "@tanstack/react-router";
import { getDashboardData } from "@/lib/bookings";
import { Dashboard } from "@/components/admin/Dashboard";

export const Route = createFileRoute("/admin/")({
  loader: async () => ({ dashboard: await getDashboardData() }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { dashboard } = Route.useLoaderData();
  const { adminUser } = Route.useRouteContext();
  // First name keeps the greeting personal ("Good morning, KRC").
  const firstName = adminUser?.name?.trim().split(/\s+/)[0] ?? "there";
  return <Dashboard data={dashboard} userName={firstName} />;
}
