import { createFileRoute } from "@tanstack/react-router";
import { getPaymentsPageData } from "@/lib/bookings";
import { Payments } from "@/components/admin/Payments";

export const Route = createFileRoute("/admin/payments")({
  loader: async () => ({ payments: await getPaymentsPageData() }),
  component: AdminPayments,
});

function AdminPayments() {
  const { payments } = Route.useLoaderData();
  return <Payments data={payments} />;
}
