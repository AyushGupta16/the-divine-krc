import { createFileRoute } from "@tanstack/react-router";
import { getBookingsPageData } from "@/lib/bookings";
import { Bookings } from "@/components/admin/Bookings";

export const Route = createFileRoute("/admin/bookings")({
  loader: async () => ({ data: await getBookingsPageData() }),
  component: AdminBookings,
});

function AdminBookings() {
  const { data } = Route.useLoaderData();
  return <Bookings data={data} />;
}
