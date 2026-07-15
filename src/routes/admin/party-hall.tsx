import { createFileRoute } from "@tanstack/react-router";
import { getPartyHallEnquiries } from "@/lib/bookings";
import { RoutePlaceholder } from "@/components/booking/RoutePlaceholder";

export const Route = createFileRoute("/admin/party-hall")({
  loader: async () => ({ enquiries: await getPartyHallEnquiries() }),
  component: AdminPartyHall,
});

function AdminPartyHall() {
  const { enquiries } = Route.useLoaderData();
  return <RoutePlaceholder title="Party Hall" count={enquiries.length} />;
}
