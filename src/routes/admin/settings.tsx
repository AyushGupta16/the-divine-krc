import { createFileRoute } from "@tanstack/react-router";
import { settingsPage } from "@/lib/bookings-data";
import { Settings } from "@/components/admin/Settings";

export const Route = createFileRoute("/admin/settings")({
  loader: async () => ({ settings: await settingsPage() }),
  component: AdminSettings,
});

function AdminSettings() {
  const { settings } = Route.useLoaderData();
  return <Settings data={settings} />;
}
