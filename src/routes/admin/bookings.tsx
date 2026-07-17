import { createFileRoute } from "@tanstack/react-router";
import { bookingsPage } from "@/lib/bookings-data";
import { Bookings } from "@/components/admin/Bookings";

export const Route = createFileRoute("/admin/bookings")({
  loader: async () => ({ data: await bookingsPage() }),
  component: AdminBookings,
});

function AdminBookings() {
  const { data } = Route.useLoaderData();
  return <Bookings data={data} />;
}
