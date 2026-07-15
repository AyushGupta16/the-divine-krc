import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { getBookings, getGuests, getRoomTypes } from "@/lib/bookings";
import { AdminShell } from "@/components/admin/AdminShell";

// Public auth pages live under /admin but must NOT be gated (guarding them
// would loop the redirect) and render without the console chrome.
const PUBLIC_ADMIN_PATHS = new Set<string>([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
]);

function normalize(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/admin";
}

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    if (PUBLIC_ADMIN_PATHS.has(normalize(location.pathname))) {
      return { adminUser: null };
    }
    const adminUser = await requireAuth(location.href);
    return { adminUser };
  },
  loader: async ({ context }) => {
    // Only the gated console needs the sidebar badge counts.
    if (!context.adminUser) {
      return { counts: { bookings: 0, guests: 0, rooms: 0 } };
    }
    const [bookings, guests, roomTypes] = await Promise.all([
      getBookings(),
      getGuests(),
      getRoomTypes(),
    ]);
    return {
      counts: {
        bookings: bookings.length,
        guests: guests.length,
        rooms: roomTypes.length,
      },
    };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { adminUser } = Route.useRouteContext();
  const { counts } = Route.useLoaderData();

  // Auth pages bring their own full-screen chrome (AuthLayout).
  if (PUBLIC_ADMIN_PATHS.has(normalize(pathname))) {
    return <Outlet />;
  }

  return <AdminShell user={adminUser} counts={counts} />;
}
