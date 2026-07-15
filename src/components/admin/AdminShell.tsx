import { useState, type ReactNode } from "react";
import { Link, Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { Menu, LogOut, ChevronDown, UserPlus, Check } from "lucide-react";

import krcLogo from "@/assets/krc-logo.jpg";
import { ADMIN_NAV, titleForPath, type NavItem } from "@/components/admin/admin-nav";
import { logoutFn, type SessionUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function isActive(pathname: string, item: NavItem): boolean {
  const path = pathname.replace(/\/$/, "") || "/admin";
  return item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/");
}

/** The brand crest + wordmark shown at the top of the sidebar. */
function SidebarBrand() {
  return (
    <div className="flex items-center gap-3 px-6 py-6">
      <img src={krcLogo} alt="The Divine KRC crest" className="h-10 w-10 shrink-0 object-contain" />
      <span className="whitespace-pre-line font-display text-[11px] italic uppercase leading-tight tracking-[0.25em] text-gold-soft">
        {"THE\nDIVINE\nKRC"}
      </span>
    </div>
  );
}

/** The navigation link list. `onNavigate` lets the mobile drawer close itself. */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-6">
      {ADMIN_NAV.map((group) => (
        <div key={group.label} className="mb-6">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a8479]">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                      active
                        ? "bg-gold/15 text-gold-soft"
                        : "text-[#c9c3b6] hover:bg-white/5 hover:text-ivory",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[18px] shrink-0",
                        active ? "text-gold" : "text-[#8a8479] group-hover:text-ivory",
                      )}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Full sidebar body — brand + nav + account chip — shared by rail and drawer. */
function SidebarBody({ user, onNavigate }: { user: SessionUser | null; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-obsidian text-ivory">
      <SidebarBrand />
      <div className="mx-6 mb-2 h-px bg-gold/20" />
      <SidebarNav onNavigate={onNavigate} />
      <SidebarAccount user={user} onNavigate={onNavigate} />
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
 * "Sign out".
 */
function SidebarAccount({
  user,
  onNavigate,
}: {
  user: SessionUser | null;
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
    <div className="border-t border-gold/15 p-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex w-full items-center gap-2.5 rounded-md bg-white/5 px-2.5 py-2.5 text-left outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-gold"
          aria-label="Account menu"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold text-[12px] font-bold text-obsidian">
            {initialsOf(user)}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[12.5px] font-semibold text-ivory">
              {user?.name ?? "Admin"}
            </span>
            <span className="block truncate text-[10.5px] text-[#8a8479]">{user?.email ?? ""}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-[#8a8479]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
        >
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

/**
 * Admin console chrome: fixed obsidian sidebar (desktop) + a drawer on mobile,
 * with a sticky header carrying the page title (the account menu lives in the
 * sidebar footer). Renders the active route through `<Outlet />`.
 */
export function AdminShell({ user }: { user: SessionUser | null }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = useRouterState({
    select: (s) => titleForPath(s.location.pathname),
  });

  return (
    <div className="min-h-screen bg-ivory font-sans text-obsidian">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 md:block">
        <SidebarBody user={user} />
      </aside>

      <div className="flex min-h-screen flex-col md:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#eae4d6] bg-ivory/90 px-4 backdrop-blur sm:px-6">
          {/* Mobile drawer trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className="flex size-9 items-center justify-center rounded-md text-obsidian transition-colors hover:bg-black/5 md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody user={user} onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <h1 className="font-display text-lg font-semibold text-obsidian sm:text-xl">
            {pageTitle}
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
