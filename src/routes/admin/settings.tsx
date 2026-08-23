import { createFileRoute, redirect } from "@tanstack/react-router";
import { settingsPage } from "@/lib/bookings-data";
import { can } from "@/lib/team";
import { Settings } from "@/components/admin/Settings";

export const Route = createFileRoute("/admin/settings")({
  beforeLoad: ({ context }) => {
    if (
      !context.member ||
      (!can(context.member.role, "settings:write") && !can(context.member.role, "team:manage"))
    ) {
      throw redirect({ to: "/admin" });
    }
  },
  loader: async () => ({ settings: await settingsPage() }),
  component: AdminSettings,
});

function AdminSettings() {
  const { settings } = Route.useLoaderData();
  return <Settings data={settings} />;
}
