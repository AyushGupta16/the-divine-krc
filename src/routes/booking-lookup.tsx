import { createFileRoute } from "@tanstack/react-router";
import { RoutePlaceholder } from "@/components/booking/RoutePlaceholder";

export const Route = createFileRoute("/booking-lookup")({
  component: BookingLookup,
});

function BookingLookup() {
  return <RoutePlaceholder title="Booking Lookup" />;
}
