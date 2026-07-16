import { createFileRoute } from "@tanstack/react-router";
import { getSettingsPageData } from "@/lib/bookings";
import { Settings } from "@/components/admin/Settings";

export const Route = createFileRoute("/admin/settings")({
  loader: async () => ({ settings: await getSettingsPageData() }),
  component: AdminSettings,
});

function AdminSettings() {
  const { settings } = Route.useLoaderData();
  return <Settings data={settings} />;
}
