import { createFileRoute } from "@tanstack/react-router";
import { RoutePlaceholder } from "@/components/booking/RoutePlaceholder";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  return <RoutePlaceholder title="Settings" />;
}
