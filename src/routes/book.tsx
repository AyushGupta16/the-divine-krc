import { createFileRoute } from "@tanstack/react-router";
import { Book } from "@/components/booking/Book";
import { getAddOnRatesFn, getRoomTypesFn } from "@/lib/bookings-data";

export const Route = createFileRoute("/book")({
  // Same source the homepage/landmark pages use (#66/#67 follow-up): a rate
  // or name edited in the admin Settings screen must show up here too, not
  // just on the marketing pages — a guest should never be quoted a stale
  // price the front desk already changed. Add-on rates (Slice B) follow the
  // same rule.
  loader: () => Promise.all([getRoomTypesFn(), getAddOnRatesFn()]),
  component: RouteComponent,
});

function RouteComponent() {
  const [roomTypes, addOnRates] = Route.useLoaderData();
  return <Book roomTypes={roomTypes} addOnRates={addOnRates} />;
}
