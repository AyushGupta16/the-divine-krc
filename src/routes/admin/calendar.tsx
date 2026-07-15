import { createFileRoute } from "@tanstack/react-router";
import { getBookings } from "@/lib/bookings";
import { RoutePlaceholder } from "@/components/booking/RoutePlaceholder";

export const Route = createFileRoute("/admin/calendar")({
  loader: async () => ({ bookings: await getBookings() }),
  component: AdminCalendar,
});

function AdminCalendar() {
  const { bookings } = Route.useLoaderData();
  return <RoutePlaceholder title="Calendar" count={bookings.length} />;
}
