import { createFileRoute } from "@tanstack/react-router";
import { getBookings } from "@/lib/bookings";
import { RoutePlaceholder } from "@/components/booking/RoutePlaceholder";

export const Route = createFileRoute("/admin/payments")({
  loader: async () => ({ bookings: await getBookings() }),
  component: AdminPayments,
});

function AdminPayments() {
  const { bookings } = Route.useLoaderData();
  return <RoutePlaceholder title="Payments" count={bookings.length} />;
}
