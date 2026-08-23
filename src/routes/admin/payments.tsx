import { createFileRoute, redirect } from "@tanstack/react-router";
import { paymentsPage } from "@/lib/bookings-data";
import { can } from "@/lib/team";
import { Payments } from "@/components/admin/Payments";

export const Route = createFileRoute("/admin/payments")({
  beforeLoad: ({ context }) => {
    if (!context.member || !can(context.member.role, "payments:read")) {
      throw redirect({ to: "/admin" });
    }
  },
  loader: async () => ({ payments: await paymentsPage() }),
  component: AdminPayments,
});

function AdminPayments() {
  const { payments } = Route.useLoaderData();
  return <Payments data={payments} />;
}
