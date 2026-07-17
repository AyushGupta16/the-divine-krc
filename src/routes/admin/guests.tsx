import { createFileRoute } from "@tanstack/react-router";
import { guestsPage } from "@/lib/bookings-data";
import { Guests } from "@/components/admin/Guests";

export const Route = createFileRoute("/admin/guests")({
  loader: async () => ({ guests: await guestsPage() }),
  component: AdminGuests,
});

function AdminGuests() {
  const { guests } = Route.useLoaderData();
  return <Guests data={guests} />;
}
