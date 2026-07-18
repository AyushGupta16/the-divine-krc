import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import {
  Menu,
  LogOut,
  ChevronDown,
  ChevronsLeft,
  UserPlus,
  Check,
  X,
  Search,
  Plus,
} from "lucide-react";

import krcLogo from "@/assets/krc-logo.jpg";
import {
  ADMIN_NAV,
  BOTTOM_NAV,
  SETTINGS_ITEM,
  titleForPath,
  type CountKey,
  type NavItem,
} from "@/components/admin/admin-nav";
import { logoutFn, type SessionUser } from "@/lib/auth";
import type { NotificationsData } from "@/lib/notifications-data";
import { NotificationsBell } from "@/components/admin/NotificationsBell";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const COLLAPSE_KEY = "krc-admin-sidebar-collapsed";
type Counts = Partial<Record<CountKey, number>>;

function isActive(pathname: string, item: NavItem): boolean {
  const path = pathname.replace(/\/$/, "") || "/admin";
  return item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/");
}

/** The brand crest + wordmark shown at the top of the sidebar. */
function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="mb-4 flex items-center gap-3 border-b border-gold/15 px-2 pb-5">
      <img
        src={krcLogo}
        alt="The Divine KRC crest"
        className="size-9 shrink-0 rounded-sm object-contain"
      />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="truncate font-display text-[12px] italic uppercase tracking-[0.22em] text-gold-soft">
            The Divine KRC
          </div>
          <div className="truncate text-[10px] uppercase tracking-[0.14em] text-[#6d675c]">
            Admin console
          </div>
        </div>
      )}
    </div>
  );
}

function NavRow({
  item,
  active,
  collapsed,
  count,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[5px] px-2.75 py-2.25 text-[13px] transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-gold/15 font-semibold text-gold"
          : "font-normal text-ivory/60 hover:bg-white/5 hover:text-ivory",
      )}
    >
      <Icon className="size-4.25 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && typeof count === "number" && count > 0 && (
        <span className="ml-auto rounded-full bg-gold px-1.75 py-px text-[10.5px] font-bold text-obsidian">
          {count}
        </span>
      )}
    </Link>
  );
}

/** Full sidebar body — brand + nav + settings + account — for rail and drawer. */
function SidebarBody({
  user,
  collapsed,
  counts,
  onNavigate,
}: {
  user: SessionUser | null;
  collapsed: boolean;
  counts: Counts;
  onNavigate?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-obsidian px-4 py-5.5 text-ivory">
      <SidebarBrand collapsed={collapsed} />

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {ADMIN_NAV.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {!collapsed && (
              <p className="px-2.5 pb-2 pt-3 text-[10px] uppercase tracking-[0.22em] text-[#6d675c] first:pt-1">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavRow
                key={item.to}
                item={item}
                active={isActive(pathname, item)}
                collapsed={collapsed}
                count={item.countKey ? counts[item.countKey] : undefined}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-2 flex flex-col gap-0.5">
        <NavRow
          item={SETTINGS_ITEM}
          active={isActive(pathname, SETTINGS_ITEM)}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <SidebarAccount user={user} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function initialsOf(user: SessionUser | null): string {
  if (!user) return "?";
  const source = user.name?.trim() || user.email;
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Account chip pinned to the sidebar footer. Opens an upward menu listing the
 * signed-in account, plus "Add account" (sign in as someone else) and
 * "Sign out". Collapses to just the avatar when the rail is collapsed.
 */
function SidebarAccount({
  user,
  collapsed,
  onNavigate,
}: {
  user: SessionUser | null;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await logoutFn();
    await router.invalidate();
    onNavigate?.();
    navigate({ to: "/admin/login" });
  }

  function addAccount() {
    // Signing in with another account reuses the login screen.
    onNavigate?.();
    navigate({ to: "/admin/login" });
  }

  return (
    <div className="mt-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          title={collapsed ? (user?.name ?? "Account") : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md bg-white/5 py-2.5 text-left outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-gold",
            collapsed ? "justify-center px-0" : "px-2.5",
          )}
          aria-label="Account menu"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold text-[12px] font-bold text-obsidian">
            {initialsOf(user)}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[12.5px] font-semibold text-ivory">
                  {user?.name ?? "Admin"}
                </span>
                <span className="block truncate text-[10.5px] text-[#8a8479]">
                  {user?.email ?? ""}
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-[#8a8479]" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" sideOffset={8} className="min-w-56">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.16em] text-warm-gray">
            Accounts
          </DropdownMenuLabel>
          <DropdownMenuItem className="gap-2.5" disabled>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold text-[11px] font-bold text-obsidian">
              {initialsOf(user)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[12px] font-semibold text-obsidian">
                {user?.name ?? "Admin"}
              </span>
              <span className="block truncate text-[10px] text-warm-gray">{user?.email}</span>
            </span>
            <Check className="size-4 shrink-0 text-gold" />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              addAccount();
            }}
          >
            <UserPlus className="size-4" />
            Add account
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={busy}
            onSelect={(e) => {
              e.preventDefault();
              void signOut();
            }}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="size-4" />
            {busy ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Header title block — a personalised greeting on the dashboard, else the page title. */
function HeaderTitle({ isDashboard, user }: { isDashboard: boolean; user: SessionUser | null }) {
  const pageTitle = useRouterState({
    select: (s) => titleForPath(s.location.pathname),
  });

  if (!isDashboard) {
    return (
      <h1 className="truncate font-display text-lg font-semibold text-obsidian sm:text-xl">
        {pageTitle}
      </h1>
    );
  }

  const now = new Date();
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "there";
  const dateLine = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="min-w-0">
      <div className="truncate font-display text-lg font-semibold leading-tight text-obsidian sm:text-xl">
        {greetingFor(now)}, {firstName}
      </div>
      <div className="hidden truncate text-[11px] tracking-[0.01em] text-[#7a746a] sm:block">
        {dateLine} · 14 rooms · 1 party hall
      </div>
    </div>
  );
}

/** Global header actions — notifications, search, new booking. */
function HeaderActions({
  notifications,
  onSearch,
}: {
  notifications: NotificationsData;
  onSearch: () => void;
}) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <NotificationsBell notifications={notifications} />
      <button
        type="button"
        onClick={onSearch}
        aria-label="Search bookings, guests"
        title="Search bookings, guests"
        className="flex size-10 items-center justify-center rounded-[5px] border border-[#eae4d6] bg-white text-warm-gray transition-colors hover:bg-black/[0.03]"
      >
        <Search className="size-4.25" />
      </button>
      <Link
        to="/admin/bookings"
        search={{ new: "1" }}
        aria-label="New booking"
        title="New booking"
        className="flex size-10 items-center justify-center rounded-[5px] bg-gold text-obsidian transition-opacity hover:opacity-90"
      >
        <Plus className="size-4.5" strokeWidth={2.4} />
      </Link>
    </div>
  );
}

const SEARCH_SHORTCUTS: NavItem[] = ADMIN_NAV.flatMap((g) => g.items);

/** Full-screen overlay opened from the header's search icon on mobile. */
function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ivory">
      <div className="flex h-16 items-center gap-3 border-b border-[#eae4d6] px-4 sm:px-6">
        <Search className="size-4.5 shrink-0 text-warm-gray" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bookings, guests…"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-obsidian outline-none placeholder:text-warm-gray/60"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-obsidian hover:bg-black/5"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 px-4 py-5 sm:px-6">
        {SEARCH_SHORTCUTS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className="inline-flex items-center gap-1.75 rounded-full border border-[#eae4d6] bg-white px-3.5 py-2 text-[12px] font-semibold text-warm-gray transition-colors hover:border-gold/50 hover:text-obsidian"
            >
              <Icon className="size-3.75" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Fixed bottom navigation for mobile — primary destinations + a "More" FAB. */
function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-15.5 items-stretch border-t border-gold/20 bg-obsidian px-0.5 md:hidden">
      {BOTTOM_NAV.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.75 transition-colors",
              active ? "text-gold" : "text-ivory/60",
            )}
          >
            {active && (
              <span className="absolute top-0 left-1/2 h-0.75 w-7.5 -translate-x-1/2 rounded-b bg-gold" />
            )}
            <Icon className="size-5" />
            <span className="text-[9.5px]">{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        className="flex flex-1 flex-col items-center justify-center gap-0.75 text-ivory/60"
      >
        <Menu className="size-5" />
        <span className="text-[9.5px]">More</span>
      </button>
    </nav>
  );
}

/**
 * Admin console chrome: collapsible obsidian sidebar (rail on desktop, off-canvas
 * drawer + bottom-nav/FAB on mobile) and a sticky header carrying the collapse
 * toggle and page title. Renders the active route through `<Outlet />`.
 */
export function AdminShell({
  user,
  counts = {},
  notifications = { groups: [], unread: 0 },
}: {
  user: SessionUser | null;
  counts?: Counts;
  notifications?: NotificationsData;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isDashboard = useRouterState({
    select: (s) => (s.location.pathname.replace(/\/$/, "") || "/admin") === "/admin",
  });

  // Restore + persist the collapsed preference (client-only to avoid SSR flash).
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);
  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const railWidth = collapsed ? "70px" : "236px";

  return (
    <div
      className="min-h-screen bg-ivory font-sans text-obsidian"
      style={{ ["--rail-w" as string]: railWidth }}
    >
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--rail-w)] transition-[width] duration-200 md:block">
        <SidebarBody user={user} collapsed={collapsed} counts={counts} />
      </aside>

      {/* Mobile off-canvas drawer */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-obsidian/50 transition-opacity md:hidden",
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-66 shadow-2xl transition-transform duration-[260ms] md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close navigation"
          className="absolute right-3 top-4 z-10 flex size-8 items-center justify-center rounded-md text-ivory/70 hover:bg-white/10"
        >
          <X className="size-5" />
        </button>
        <SidebarBody
          user={user}
          collapsed={false}
          counts={counts}
          onNavigate={() => setDrawerOpen(false)}
        />
      </aside>

      <div className="flex min-h-screen flex-col pb-15.5 transition-[padding] duration-200 md:pb-0 md:pl-[var(--rail-w)]">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#eae4d6] bg-ivory/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden size-9 items-center justify-center rounded-md text-obsidian transition-colors hover:bg-black/5 md:flex"
          >
            <ChevronsLeft
              className={cn("size-5 transition-transform", collapsed && "rotate-180")}
            />
          </button>

          <HeaderTitle isDashboard={isDashboard} user={user} />
          <HeaderActions notifications={notifications} onSearch={() => setSearchOpen(true)} />
        </header>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      <BottomNav onMore={() => setDrawerOpen(true)} />
    </div>
  );
}
