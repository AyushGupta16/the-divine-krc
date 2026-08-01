import { createFileRoute } from "@tanstack/react-router";
import { Book } from "@/components/booking/Book";
import { getRoomTypesFn } from "@/lib/bookings-data";

export const Route = createFileRoute("/book")({
  // Same source the homepage/landmark pages use (#66/#67 follow-up): a rate
  // or name edited in the admin Settings screen must show up here too, not
  // just on the marketing pages — a guest should never be quoted a stale
  // price the front desk already changed.
  loader: () => getRoomTypesFn(),
  component: RouteComponent,
});

function RouteComponent() {
  const roomTypes = Route.useLoaderData();
  return <Book roomTypes={roomTypes} />;
}
