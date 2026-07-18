import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { bookingsPage } from "@/lib/bookings-data";
import { Bookings } from "@/components/admin/Bookings";

const searchSchema = z.object({
  new: z.literal("1").optional(),
  guest: z.string().optional(),
});

export const Route = createFileRoute("/admin/bookings")({
  validateSearch: searchSchema,
  loader: async () => ({ data: await bookingsPage() }),
  component: AdminBookings,
});

function AdminBookings() {
  const { data } = Route.useLoaderData();
  const { new: openEntry, guest } = Route.useSearch();
  return <Bookings data={data} openEntryForm={openEntry === "1"} guestFilter={guest} />;
}
