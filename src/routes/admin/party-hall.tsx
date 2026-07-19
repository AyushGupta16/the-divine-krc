import { createFileRoute } from "@tanstack/react-router";
import { partyHallPage } from "@/lib/bookings-data";
import { PartyHall } from "@/components/admin/PartyHall";

export const Route = createFileRoute("/admin/party-hall")({
  loader: async () => ({ partyHall: await partyHallPage() }),
  component: AdminPartyHall,
});

function AdminPartyHall() {
  const { partyHall } = Route.useLoaderData();
  return <PartyHall data={partyHall} />;
}
