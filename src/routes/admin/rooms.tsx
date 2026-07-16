import { createFileRoute } from "@tanstack/react-router";
import { getRoomsPageData } from "@/lib/bookings";
import { Rooms } from "@/components/admin/Rooms";

export const Route = createFileRoute("/admin/rooms")({
  loader: async () => ({ rooms: await getRoomsPageData() }),
  component: AdminRooms,
});

function AdminRooms() {
  const { rooms } = Route.useLoaderData();
  return <Rooms data={rooms} />;
}
