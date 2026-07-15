import { createFileRoute } from "@tanstack/react-router";
import { getGuests } from "@/lib/bookings";
import { RoutePlaceholder } from "@/components/booking/RoutePlaceholder";

export const Route = createFileRoute("/admin/guests")({
  loader: async () => ({ guests: await getGuests() }),
  component: AdminGuests,
});

function AdminGuests() {
  const { guests } = Route.useLoaderData();
  return <RoutePlaceholder title="Guests" count={guests.length} />;
}
