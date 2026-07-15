import { createFileRoute } from "@tanstack/react-router";
import { getRoomTypes } from "@/lib/bookings";
import { RoutePlaceholder } from "@/components/booking/RoutePlaceholder";

export const Route = createFileRoute("/admin/rooms")({
  loader: async () => ({ roomTypes: await getRoomTypes() }),
  component: AdminRooms,
});

function AdminRooms() {
  const { roomTypes } = Route.useLoaderData();
  return <RoutePlaceholder title="Room Management" count={roomTypes.length} />;
}
