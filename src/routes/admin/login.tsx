import { useState } from "react";
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { Eye, EyeOff, AlertCircle, Check } from "lucide-react";
import { z } from "zod";
import { AuthLayout } from "@/components/admin/AuthLayout";
import { googleLoginFn, loginFn } from "@/lib/auth";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/admin/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});

const inputClass =
  "w-full rounded-[5px] border border-[#e5ddcb] bg-white px-3.5 py-3 text-sm text-obsidian outline-none transition-colors placeholder:text-[#b3aa96] focus:border-gold";
const labelClass =
  "block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7a746a]";
const goldButtonClass =
  "w-full cursor-pointer rounded-[5px] bg-gold px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] text-obsidian transition-opacity hover:opacity-90 disabled:opacity-60";

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function goToConsole() {
    await router.invalidate();
    navigate({ to: redirect ?? "/admin" });
  }

  async function signIn() {
    if (!email.trim() || !pw.trim()) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await loginFn({ data: { email, password: pw } });
    setBusy(false);
    if (res.ok) {
      await goToConsole();
    } else {
      setError(res.error);
    }
  }

  async function google() {
    setBusy(true);
    setError(null);
    await googleLoginFn();
    setBusy(false);
    await goToConsole();
  }

  return (
    <AuthLayout
      eyebrow="Admin console"
      title="Manage every stay,"
      titleAccent="effortlessly."
      description="Bookings, rooms, party-hall enquiries, payments and reports for The Divine KRC — all in one place."
      panelFooter={
        <div className="flex gap-7">
          {[
            { n: "14", l: "Rooms" },
            { n: "150", l: "Hall guests" },
            { n: "₹ INR", l: "Live revenue" },
          ].map((s) => (
            <div key={s.l}>
              <div className="font-display text-[22px] text-gold-soft">
                {s.n}
              </div>
              <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.14em] text-[#8a8479]">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      }
    >
      <h2 className="mb-1.5 font-display text-[26px] font-semibold">
        Welcome back
      </h2>
      <p className="mb-7 text-[13px] text-[#7a746a]">
        Sign in to the admin console.
      </p>

      {error && (
        <div className="mb-4.5 flex items-center gap-2.5 rounded-md border border-[#e6cbc2] bg-[#f7e6e0] px-3.5 py-2.5">
          <AlertCircle className="size-4 shrink-0 text-[#b4553f]" />
          <span className="text-[12.5px] font-medium text-[#b4553f]">
            {error}
          </span>
        </div>
      )}

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn();
        }}
      >
        <div>
          <label className={cn(labelClass, "mb-1.5")} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="you@thedivinekrc.in"
            autoComplete="email"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className={labelClass} htmlFor="password">
              Password
            </label>
            <Link
              to="/admin/forgot-password"
              className="text-[11px] font-semibold text-gold hover:text-gold-soft"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              className={cn(inputClass, "pr-11")}
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setError(null);
              }}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center text-[#a49d8d]"
            >
              {showPw ? (
                <EyeOff className="size-[17px]" />
              ) : (
                <Eye className="size-[17px]" />
              )}
            </button>
          </div>
        </div>

        <label className="flex cursor-pointer select-none items-center gap-2.5 text-[12.5px] text-warm-gray">
          <button
            type="button"
            onClick={() => setRemember((v) => !v)}
            aria-pressed={remember}
            className={cn(
              "flex size-[18px] shrink-0 items-center justify-center rounded border-[1.5px]",
              remember ? "border-gold bg-gold" : "border-[#c3bcae] bg-white",
            )}
          >
            {remember && <Check className="size-3 text-obsidian" strokeWidth={3} />}
          </button>
          Keep me signed in
        </label>

        <button type="submit" disabled={busy} className={cn(goldButtonClass, "mt-1")}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="my-3 flex items-center gap-2.5 text-[10.5px] uppercase tracking-[0.14em] text-[#a49d8d]">
        <span className="h-px flex-1 bg-[#eae4d6]" />
        or
        <span className="h-px flex-1 bg-[#eae4d6]" />
      </div>

      <button
        type="button"
        onClick={() => void google()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-[5px] border border-[#e5ddcb] bg-white px-4 py-3 text-[13px] font-semibold text-[#2a2a2a] transition-colors hover:bg-ivory disabled:opacity-60"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="mt-6 flex items-center gap-2.5 text-[11px] text-[#a49d8d]">
        <span className="h-px flex-1 bg-[#eae4d6]" />
        Secure area
        <span className="h-px flex-1 bg-[#eae4d6]" />
      </div>
      <p className="mt-4 text-center text-[12px] leading-relaxed text-[#7a746a]">
        Trouble signing in?{" "}
        <a href="https://wa.me/918707368307" className="text-gold hover:text-gold-soft">
          WhatsApp support
        </a>
        <br />
        or call{" "}
        <a href="tel:+918707368307" className="text-gold hover:text-gold-soft">
          +91 87073 68307
        </a>
      </p>
    </AuthLayout>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}
