import { createFileRoute } from "@tanstack/react-router";
import { paymentsPage } from "@/lib/bookings-data";
import { Payments } from "@/components/admin/Payments";

export const Route = createFileRoute("/admin/payments")({
  loader: async () => ({ payments: await paymentsPage() }),
  component: AdminPayments,
});

function AdminPayments() {
  const { payments } = Route.useLoaderData();
  return <Payments data={payments} />;
}
