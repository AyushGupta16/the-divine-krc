import { createFileRoute } from "@tanstack/react-router";
import { roomsPage } from "@/lib/bookings-data";
import { Rooms } from "@/components/admin/Rooms";

export const Route = createFileRoute("/admin/rooms")({
  loader: async () => ({ rooms: await roomsPage() }),
  component: AdminRooms,
});

function AdminRooms() {
  const { rooms } = Route.useLoaderData();
  const { member } = Route.useRouteContext();
  return <Rooms data={rooms} member={member} />;
}
