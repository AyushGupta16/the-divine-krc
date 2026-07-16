import { createFileRoute } from "@tanstack/react-router";
import { getDashboardData } from "@/lib/bookings";
import { Dashboard } from "@/components/admin/Dashboard";

export const Route = createFileRoute("/admin/")({
  loader: async () => ({ dashboard: await getDashboardData() }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { dashboard } = Route.useLoaderData();
  return <Dashboard data={dashboard} />;
}
