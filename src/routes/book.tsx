import { createFileRoute } from "@tanstack/react-router";
import { getRoomTypes } from "@/lib/bookings";
import { RoutePlaceholder } from "@/components/booking/RoutePlaceholder";

export const Route = createFileRoute("/book")({
  loader: async () => ({ roomTypes: await getRoomTypes() }),
  component: Book,
});

function Book() {
  const { roomTypes } = Route.useLoaderData();
  return <RoutePlaceholder title="Book a Room" count={roomTypes.length} />;
}
