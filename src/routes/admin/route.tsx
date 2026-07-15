import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";

// Public auth pages live under /admin but must NOT be gated (guarding them
// would loop the redirect). Everything else under /admin requires a session.
const PUBLIC_ADMIN_PATHS = new Set<string>([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
]);

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    const path = location.pathname.replace(/\/$/, "") || "/admin";
    if (PUBLIC_ADMIN_PATHS.has(path)) return;
    await requireAuth(location.href);
  },
  component: AdminLayout,
});

function AdminLayout() {
  // PR #2 (admin shell) replaces this with the sidebar + header chrome.
  return <Outlet />;
}
