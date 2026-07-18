import { createFileRoute } from "@tanstack/react-router";
import { notificationsFn } from "@/lib/notifications-data";
import { Notifications } from "@/components/admin/Notifications";

export const Route = createFileRoute("/admin/notifications")({
  loader: async () => ({ data: await notificationsFn() }),
  component: AdminNotifications,
});

function AdminNotifications() {
  const { data } = Route.useLoaderData();
  return <Notifications data={data} />;
}
