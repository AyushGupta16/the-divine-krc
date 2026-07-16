import { useMemo, useState } from "react";
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

// The password form, shared by "reset my password" and "accept an invite".
// Both are the same act — a person holding a one-time token chooses a
// credential — and PR #12 needs the second, so the rules live here once. A
// password that would be accepted on one screen cannot be refused on the other.

const inputClass =
  "w-full rounded-[5px] border border-[#e5ddcb] bg-white px-3.5 py-3 text-sm text-obsidian outline-none transition-colors placeholder:text-[#b3aa96] focus:border-gold";
const labelClass =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7a746a]";
const goldButtonClass =
  "w-full cursor-pointer rounded-[5px] bg-gold px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] text-obsidian transition-opacity hover:opacity-90 disabled:opacity-60";

const METER_PALETTE = ["#b4553f", "#c0873c", "#c5a059", "#5a8a5a"];
const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

function scorePassword(pw: string): number {
  if (pw.length === 0) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

export interface SetPasswordFormProps {
  /** Submits the chosen password; the caller owns the token and the redirect. */
  onSubmit: (password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  submitLabel: string;
  busyLabel: string;
  /** Shown instead of the fields being usable — e.g. a link with no token. */
  blockedReason?: string | null;
}

export function SetPasswordForm({
  onSubmit,
  submitLabel,
  busyLabel,
  blockedReason = null,
}: SetPasswordFormProps) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const score = useMemo(() => scorePassword(pw), [pw]);
  const activeColor = score === 0 ? "#7a746a" : METER_PALETTE[Math.min(score - 1, 3)];
  const mismatch = pw2.length > 0 && pw !== pw2;
  const canSubmit = pw.length >= 8 && pw === pw2 && !blockedReason;
  const shown = error ?? blockedReason;

  async function submit() {
    setError(null);
    if (blockedReason) {
      setError(blockedReason);
      return;
    }
    if (pw.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const res = await onSubmit(pw);
    setBusy(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <>
      {shown && (
        <div className="mb-4.5 flex items-center gap-2.5 rounded-md border border-[#e6cbc2] bg-[#f7e6e0] px-3.5 py-2.5">
          <AlertCircle className="size-4 shrink-0 text-[#b4553f]" />
          <span className="text-[12.5px] font-medium text-[#b4553f]">{shown}</span>
        </div>
      )}

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <label className={labelClass} htmlFor="new-password">
            New password
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showPw ? "text" : "password"}
              className={cn(inputClass, "pr-11")}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center text-[#a49d8d]"
            >
              {showPw ? <EyeOff className="size-4.25" /> : <Eye className="size-4.25" />}
            </button>
          </div>
          <div className="mt-2.5 flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-[3px]"
                style={{
                  background: i < score ? METER_PALETTE[Math.min(score - 1, 3)] : "#e5ddcb",
                }}
              />
            ))}
          </div>
          <div className="mt-1.5 text-[11px] font-semibold" style={{ color: activeColor }}>
            {pw.length === 0 ? "Enter a password" : `${STRENGTH_LABELS[score]} password`}
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="confirm-password">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type={showPw ? "text" : "password"}
            className={inputClass}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          {mismatch && (
            <div className="mt-1.5 text-[11px] font-medium text-[#b4553f]">
              Passwords don't match.
            </div>
          )}
        </div>

        <button type="submit" disabled={busy || !canSubmit} className={cn(goldButtonClass, "mt-1")}>
          {busy ? busyLabel : submitLabel}
          {canSubmit && !busy && <Check className="ml-1 inline size-3.5" />}
        </button>
      </form>
    </>
  );
}
