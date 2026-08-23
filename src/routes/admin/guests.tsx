import { createFileRoute, redirect } from "@tanstack/react-router";
import { guestsPage } from "@/lib/bookings-data";
import { can } from "@/lib/team";
import { Guests } from "@/components/admin/Guests";

export const Route = createFileRoute("/admin/guests")({
  beforeLoad: ({ context }) => {
    if (!context.member || !can(context.member.role, "guests:read")) {
      throw redirect({ to: "/admin" });
    }
  },
  loader: async () => ({ guests: await guestsPage() }),
  component: AdminGuests,
});

function AdminGuests() {
  const { guests } = Route.useLoaderData();
  return <Guests data={guests} />;
}
