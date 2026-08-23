import { createFileRoute, redirect } from "@tanstack/react-router";
import { getInvitePageData } from "@/lib/invites";
import { can } from "@/lib/team";
import { Invite } from "@/components/admin/Invite";

// `settings_.invite` — the URL sits under Settings (which is what keeps Settings
// active in the sidebar, as the design shows) without nesting inside the
// Settings page's own component.
export const Route = createFileRoute("/admin/settings_/invite")({
  beforeLoad: ({ context }) => {
    if (!context.member || !can(context.member.role, "team:manage")) {
      throw redirect({ to: "/admin" });
    }
  },
  loader: async () => ({ invite: await getInvitePageData() }),
  component: AdminInvite,
});

function AdminInvite() {
  const { invite } = Route.useLoaderData();
  return <Invite data={invite} />;
}
