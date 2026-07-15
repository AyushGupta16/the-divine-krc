import { createFileRoute } from "@tanstack/react-router";
import { getBookings } from "@/lib/bookings";
import { RoutePlaceholder } from "@/components/booking/RoutePlaceholder";

export const Route = createFileRoute("/admin/bookings")({
  loader: async () => ({ bookings: await getBookings() }),
  component: AdminBookings,
});

function AdminBookings() {
  const { bookings } = Route.useLoaderData();
  return <RoutePlaceholder title="Bookings" count={bookings.length} />;
}
