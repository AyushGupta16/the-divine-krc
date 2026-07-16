import { createFileRoute } from "@tanstack/react-router";
import { getGuestsPageData } from "@/lib/bookings";
import { Guests } from "@/components/admin/Guests";

export const Route = createFileRoute("/admin/guests")({
  loader: async () => ({ guests: await getGuestsPageData() }),
  component: AdminGuests,
});

function AdminGuests() {
  const { guests } = Route.useLoaderData();
  return <Guests data={guests} />;
}
