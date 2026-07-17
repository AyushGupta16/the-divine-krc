import { createFileRoute } from "@tanstack/react-router";
import { reportsPage } from "@/lib/bookings-data";
import { Reports } from "@/components/admin/Reports";

export const Route = createFileRoute("/admin/reports")({
  loader: async () => ({ reports: await reportsPage() }),
  component: AdminReports,
});

function AdminReports() {
  const { reports } = Route.useLoaderData();
  return <Reports data={reports} />;
}
