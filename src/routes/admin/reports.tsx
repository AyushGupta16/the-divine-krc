import { createFileRoute } from "@tanstack/react-router";
import { getReportsPageData } from "@/lib/bookings";
import { Reports } from "@/components/admin/Reports";

export const Route = createFileRoute("/admin/reports")({
  loader: async () => ({ reports: await getReportsPageData() }),
  component: AdminReports,
});

function AdminReports() {
  const { reports } = Route.useLoaderData();
  return <Reports data={reports} />;
}
