import { createFileRoute } from "@tanstack/react-router";
import { getBookings } from "@/lib/bookings";
import { RoutePlaceholder } from "@/components/booking/RoutePlaceholder";

export const Route = createFileRoute("/admin/reports")({
  loader: async () => ({ bookings: await getBookings() }),
  component: AdminReports,
});

function AdminReports() {
  const { bookings } = Route.useLoaderData();
  return <RoutePlaceholder title="Reports" count={bookings.length} />;
}
