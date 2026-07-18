import { createFileRoute } from "@tanstack/react-router";
import { BookingLookup } from "@/components/booking/BookingLookup";

export const Route = createFileRoute("/booking-lookup")({
  component: BookingLookup,
});
