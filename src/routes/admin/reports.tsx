import { createFileRoute, redirect } from "@tanstack/react-router";
import { reportsPage } from "@/lib/bookings-data";
import { can } from "@/lib/team";
import { Reports } from "@/components/admin/Reports";

export const Route = createFileRoute("/admin/reports")({
  beforeLoad: ({ context }) => {
    if (!context.member || !can(context.member.role, "reports:read")) {
      throw redirect({ to: "/admin" });
    }
  },
  loader: async () => ({ reports: await reportsPage() }),
  component: AdminReports,
});

function AdminReports() {
  const { reports } = Route.useLoaderData();
  return <Reports data={reports} />;
}
