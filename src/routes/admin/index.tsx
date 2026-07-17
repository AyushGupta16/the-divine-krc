import { createFileRoute } from "@tanstack/react-router";
import { dashboardPage } from "@/lib/bookings-data";
import { Dashboard } from "@/components/admin/Dashboard";

export const Route = createFileRoute("/admin/")({
  loader: async () => ({ dashboard: await dashboardPage() }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { dashboard } = Route.useLoaderData();
  return <Dashboard data={dashboard} />;
}
