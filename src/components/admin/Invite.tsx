import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import type { InvitePageData, RoleOption, TeamRow } from "@/types/booking";
import type { Role } from "@/lib/team";
import { resendInviteFn, revokeInviteFn, sendInviteFn } from "@/lib/invites";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ── Tokens ──────────────────────────────────────────────────────────────────

const CARD = "rounded-lg border border-[#eae4d6] bg-white";
const FIELD =
  "h-auto rounded-[5px] border-[#e5ddcb] bg-white px-3.25 py-2.75 text-[13.5px] shadow-none " +
  "placeholder:text-[#b3aa96] focus-visible:border-gold focus-visible:ring-0";
const LABEL = "mb-1.75 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7a746a]";

/** Avatar colours, cycled by position — the roster has no colour of its own. */
const AVATAR_COLORS = [
  { bg: "#f0e7d3", color: "#a8863f" },
  { bg: "#e4eef7", color: "#3a6ea5" },
  { bg: "#e6efe6", color: "#5a8a5a" },
  { bg: "#eee7f7", color: "#7c5cbf" },
  { bg: "#f7e6e0", color: "#b4553f" },
];

/** Status colours, in the design's order: live, waiting, lapsed. */
const STATUS_COLOR: Record<TeamRow["status"], string> = {
  Active: "#5a8a5a",
  Pending: "#a8863f",
  Expired: "#a49d8d",
};

// ── Pieces ──────────────────────────────────────────────────────────────────

function RoleChips({
  roles,
  value,
  onPick,
}: {
  roles: RoleOption[];
  value: Role;
  onPick: (role: Role) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {roles.map((r) => {
        const on = r.role === value;
        return (
          <button
            key={r.role}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(r.role)}
            className={cn(
              "flex-1 cursor-pointer rounded-md border px-1.5 py-2.5 text-[11.5px] font-semibold transition-colors",
              on
                ? "border-gold bg-[#faf3e3] text-[#a8863f]"
                : "border-[#e5ddcb] bg-white text-[#4a4a4a] hover:border-[#d9d0c4]",
            )}
          >
            {r.role}
          </button>
        );
      })}
    </div>
  );
}

function StatusDot({ status }: { status: TeamRow["status"] }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold"
      style={{ color }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

function RowActions({
  row,
  canManage,
  busy,
  onResend,
  onRevoke,
}: {
  row: TeamRow;
  canManage: boolean;
  busy: boolean;
  onResend: (row: TeamRow) => void;
  onRevoke: (row: TeamRow) => void;
}) {
  // An accepted member has no invite to act on; "Manage" is a later pass.
  if (row.token === null) {
    return <span className="text-[11px] font-semibold text-[#7a746a]">Manage</span>;
  }
  if (!canManage) return null;

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => onResend(row)}
        className="cursor-pointer text-[11px] font-semibold text-gold hover:text-gold-soft disabled:opacity-50"
      >
        {row.status === "Expired" ? "Re-invite" : "Resend"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onRevoke(row)}
        className="cursor-pointer text-[11px] font-semibold text-[#7a746a] hover:text-[#b4553f] disabled:opacity-50"
      >
        Revoke
      </button>
    </span>
  );
}

function MemberRow({
  row,
  index,
  canManage,
  busy,
  onResend,
  onRevoke,
}: {
  row: TeamRow;
  index: number;
  canManage: boolean;
  busy: boolean;
  onResend: (row: TeamRow) => void;
  onRevoke: (row: TeamRow) => void;
}) {
  const av = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div className="grid grid-cols-[1.7fr_1fr_1fr_130px] items-center gap-3.5 border-b border-[#f2ede2] px-6 py-3.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
          style={{ background: av.bg, color: av.color }}
        >
          {row.initials}
        </span>
        <span className="leading-[1.3]">
          <span className="block text-[13px] font-semibold">{row.name}</span>
          <span className="block text-[11px] text-[#a49d8d]">{row.email}</span>
        </span>
      </div>
      <div>
        <span className="rounded-full border border-[#e5ddcb] px-2.75 py-0.75 text-[11.5px] font-semibold text-[#4a4a4a]">
          {row.role}
        </span>
      </div>
      <div>
        <StatusDot status={row.status} />
      </div>
      <div className="text-right">
        <RowActions
          row={row}
          canManage={canManage}
          busy={busy}
          onResend={onResend}
          onRevoke={onRevoke}
        />
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export function Invite({ data }: { data: InvitePageData }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(data.roles[1]?.role ?? data.roles[0].role);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hint = data.roles.find((r) => r.role === role)?.hint ?? "";

  async function send() {
    setError(null);
    setBusy(true);
    const res = await sendInviteFn({ data: { email, role, message } });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSentTo(res.email);
    setEmail("");
    setMessage("");
    await router.invalidate();
  }

  async function resend(row: TeamRow) {
    setBusy(true);
    const res = await resendInviteFn({ data: { token: row.token! } });
    setBusy(false);
    if (res.ok) toast.success(`Invite re-sent to ${res.email}.`);
    else toast.error(res.error);
    await router.invalidate();
  }

  async function revoke(row: TeamRow) {
    setBusy(true);
    const res = await revokeInviteFn({ data: { token: row.token! } });
    setBusy(false);
    if (res.ok) toast.success(`Invite for ${res.email} revoked.`);
    else toast.error(res.error);
    await router.invalidate();
  }

  return (
    <div className="flex flex-col gap-4.5 p-4 sm:p-6.5">
      <p className="text-[12px] tracking-[0.01em] text-[#7a746a]">
        Invite people to the admin console · {data.seatLabel}
      </p>

      <div className="flex max-w-[920px] flex-col gap-4.5">
        {/* Invite form */}
        <section className={cn(CARD, "px-6 py-5.5")}>
          <h2 className="mb-1 font-display text-[17px] font-semibold">Invite a team member</h2>
          <p className="mb-4.5 text-[12px] text-[#a49d8d]">
            They'll get an email link to set a password. Access is scoped by role.
          </p>

          {!data.canManage && (
            <p className="mb-4 rounded-md border border-[#e6cbc2] bg-[#f7e6e0] px-3.5 py-2.5 text-[12px] font-medium text-[#b4553f]">
              Your role cannot invite people. Ask an owner or manager.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-[2]">
              <label className={LABEL} htmlFor="invite-email">
                Email address
              </label>
              <Input
                id="invite-email"
                type="email"
                className={FIELD}
                value={email}
                disabled={!data.canManage}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSentTo(null);
                  setError(null);
                }}
                placeholder="name@thedivinekrc.in"
              />
            </div>
            <div className="min-w-[150px] flex-1">
              <span className={LABEL}>Role</span>
              <RoleChips roles={data.roles} value={role} onPick={setRole} />
            </div>
            <button
              type="button"
              disabled={busy || !data.canManage}
              onClick={() => void send()}
              className="flex h-[41px] cursor-pointer items-center gap-2 rounded-[5px] bg-gold px-5.5 text-[11px] font-bold uppercase tracking-[0.16em] text-obsidian transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Send invite
            </button>
          </div>

          <div className="mt-3.5">
            <label className={LABEL} htmlFor="invite-message">
              Message <span className="normal-case tracking-normal text-[#b3aa96]">(optional)</span>
            </label>
            <textarea
              id="invite-message"
              rows={2}
              value={message}
              disabled={!data.canManage}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Anything you'd like them to read before they join."
              className="w-full resize-none rounded-[5px] border border-[#e5ddcb] bg-white px-3.25 py-2.5 text-[13px] outline-none placeholder:text-[#b3aa96] focus:border-gold disabled:opacity-60"
            />
          </div>

          <p className="mt-3.5 rounded-md border border-[#efe4cc] bg-[#faf7ef] px-3.5 py-2.75 text-[11.5px] leading-[1.6] text-[#7a746a]">
            {hint}
          </p>

          {error && (
            <p className="mt-3 rounded-md border border-[#e6cbc2] bg-[#f7e6e0] px-3.25 py-2.5 text-[12.5px] font-medium text-[#b4553f]">
              {error}
            </p>
          )}

          {sentTo && (
            <p className="mt-3 flex items-center gap-2.25 rounded-md border border-[#cfe0cf] bg-[#e6efe6] px-3.25 py-2.5">
              <Check className="size-4 shrink-0 text-[#5a8a5a]" />
              <span className="text-[12.5px] font-medium text-[#3f6b3f]">
                Invite sent to {sentTo}.
              </span>
            </p>
          )}
        </section>

        {/* Members & invites */}
        <section className={cn(CARD, "overflow-hidden")}>
          <div className="flex items-center border-b border-[#eae4d6] px-6 py-4">
            <h2 className="font-display text-[16px] font-semibold">Members &amp; invites</h2>
            <span className="ml-auto text-[11.5px] text-[#a49d8d]">{data.rows.length} people</span>
          </div>
          {data.rows.map((row, i) => (
            <MemberRow
              key={row.email}
              row={row}
              index={i}
              canManage={data.canManage}
              busy={busy}
              onResend={(r) => void resend(r)}
              onRevoke={(r) => void revoke(r)}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
