import { createFileRoute } from "@tanstack/react-router";
import { getBookings } from "@/lib/bookings";
import { RoutePlaceholder } from "@/components/booking/RoutePlaceholder";

export const Route = createFileRoute("/admin/")({
  loader: async () => ({ bookings: await getBookings() }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { bookings } = Route.useLoaderData();
  return <RoutePlaceholder title="Dashboard" count={bookings.length} />;
}
