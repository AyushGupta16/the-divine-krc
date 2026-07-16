import { createFileRoute } from "@tanstack/react-router";
import { getPartyHallPageData } from "@/lib/bookings";
import { PartyHall } from "@/components/admin/PartyHall";

export const Route = createFileRoute("/admin/party-hall")({
  loader: async () => ({ partyHall: await getPartyHallPageData() }),
  component: AdminPartyHall,
});

function AdminPartyHall() {
  const { partyHall } = Route.useLoaderData();
  return <PartyHall data={partyHall} />;
}
