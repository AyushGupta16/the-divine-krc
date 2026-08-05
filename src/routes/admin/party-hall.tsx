import { createFileRoute } from "@tanstack/react-router";
import { partyHallPage } from "@/lib/bookings-data";
import { normalizeCalendarSearch } from "@/lib/bookings";
import { PartyHall } from "@/components/admin/PartyHall";

export const Route = createFileRoute("/admin/party-hall")({
  validateSearch: (search: Record<string, unknown>) => normalizeCalendarSearch(search),
  loaderDeps: ({ search }) => ({ year: search.year, month: search.month }),
  loader: async ({ deps }) => ({
    partyHall: await partyHallPage({ data: { year: deps.year, month: deps.month } }),
  }),
  component: AdminPartyHall,
});

function AdminPartyHall() {
  const { partyHall } = Route.useLoaderData();
  const { year, month } = Route.useSearch();
  return <PartyHall data={partyHall} year={year} month={month} />;
}
