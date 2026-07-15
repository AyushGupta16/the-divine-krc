import {
  LayoutDashboard,
  CalendarDays,
  BookMarked,
  BedDouble,
  PartyPopper,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Match only on an exact path (used for the index route). */
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Single source of truth for the admin console navigation. Consumed by the
 * sidebar (to render links) and the header (to resolve the active page title).
 */
export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", to: "/admin", icon: LayoutDashboard, exact: true },
      { label: "Calendar", to: "/admin/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Bookings", to: "/admin/bookings", icon: BookMarked },
      { label: "Rooms", to: "/admin/rooms", icon: BedDouble },
      { label: "Party Hall", to: "/admin/party-hall", icon: PartyPopper },
      { label: "Guests", to: "/admin/guests", icon: Users },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Payments", to: "/admin/payments", icon: CreditCard },
      { label: "Reports", to: "/admin/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Account",
    items: [{ label: "Settings", to: "/admin/settings", icon: Settings }],
  },
];

/** Flat list of every nav item, longest path first for title matching. */
const FLAT_ITEMS = ADMIN_NAV.flatMap((g) => g.items).sort((a, b) => b.to.length - a.to.length);

/** Resolve the human page title for a given pathname. */
export function titleForPath(pathname: string): string {
  const path = pathname.replace(/\/$/, "") || "/admin";
  const match = FLAT_ITEMS.find((item) =>
    item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/"),
  );
  return match?.label ?? "Admin";
}
