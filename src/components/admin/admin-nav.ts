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

/** Keys for dynamic count badges resolved by the shell. */
export type CountKey = "bookings" | "rooms" | "guests";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Match only on an exact path (used for the index route). */
  exact?: boolean;
  /** When set, the shell renders a count badge from its `counts` map. */
  countKey?: CountKey;
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
      { label: "Bookings", to: "/admin/bookings", icon: BookMarked, countKey: "bookings" },
      { label: "Guests", to: "/admin/guests", icon: Users, countKey: "guests" },
      { label: "Rooms", to: "/admin/rooms", icon: BedDouble, countKey: "rooms" },
      { label: "Party Hall", to: "/admin/party-hall", icon: PartyPopper },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Payments", to: "/admin/payments", icon: CreditCard },
      { label: "Reports", to: "/admin/reports", icon: BarChart3 },
    ],
  },
];

/** Pinned to the sidebar footer, above the account chip. */
export const SETTINGS_ITEM: NavItem = {
  label: "Settings",
  to: "/admin/settings",
  icon: Settings,
};

/** Primary destinations surfaced in the mobile bottom navigation bar. */
export const BOTTOM_NAV: NavItem[] = [
  { label: "Home", to: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Bookings", to: "/admin/bookings", icon: BookMarked },
  { label: "Rooms", to: "/admin/rooms", icon: BedDouble },
  { label: "Calendar", to: "/admin/calendar", icon: CalendarDays },
];

/** Flat list of every nav item, longest path first for title matching. */
const FLAT_ITEMS = [...ADMIN_NAV.flatMap((g) => g.items), SETTINGS_ITEM].sort(
  (a, b) => b.to.length - a.to.length,
);

/** Resolve the human page title for a given pathname. */
export function titleForPath(pathname: string): string {
  const path = pathname.replace(/\/$/, "") || "/admin";
  const match = FLAT_ITEMS.find((item) =>
    item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/"),
  );
  return match?.label ?? "Admin";
}
