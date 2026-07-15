import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, AlertCircle, Mail } from "lucide-react";
import { AuthLayout } from "@/components/admin/AuthLayout";
import { requestResetFn } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/forgot-password")({
  component: ForgotPasswordPage,
});

const EMAIL_RE = /^\S+@\S+\.\S+$/;

const inputClass =
  "w-full rounded-[5px] border border-[#e5ddcb] bg-white px-3.5 py-3 text-sm text-obsidian outline-none transition-colors placeholder:text-[#b3aa96] focus:border-gold";
const labelClass =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7a746a]";
const goldButtonClass =
  "w-full cursor-pointer rounded-[5px] bg-gold px-4 py-3.5 text-[11px] font-bold uppercase tracking-[0.2em] text-obsidian transition-opacity hover:opacity-90 disabled:opacity-60";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!EMAIL_RE.test(email.trim())) {
      setError(true);
      return;
    }
    setBusy(true);
    // Always succeeds — we never reveal whether the email exists.
    await requestResetFn({ data: { email: email.trim() } });
    setBusy(false);
    setSent(true);
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Locked out?"
      titleAccent="We'll help you back in."
      description="Enter the email tied to your admin account and we'll send a secure reset link. Links expire in 30 minutes."
      panelFooter={
        <p className="text-[12px] leading-[1.7] text-[#8a8479]">
          Only invited team members can reset access. Need a new account? Ask
          your property manager to send an invite.
        </p>
      }
    >
      {!sent ? (
        <div>
          <Link
            to="/admin/login"
            className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#7a746a] hover:text-obsidian"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
          <h2 className="mb-1.5 font-display text-[26px] font-semibold">
            Reset password
          </h2>
          <p className="mb-7 text-[13px] text-[#7a746a]">
            We'll email you a link to set a new one.
          </p>

          {error && (
            <div className="mb-4.5 flex items-center gap-2.5 rounded-md border border-[#e6cbc2] bg-[#f7e6e0] px-3.5 py-2.5">
              <AlertCircle className="size-4 shrink-0 text-[#b4553f]" />
              <span className="text-[12.5px] font-medium text-[#b4553f]">
                Enter a valid email address.
              </span>
            </div>
          )}

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <div>
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(false);
                }}
                placeholder="you@thedivinekrc.in"
                autoComplete="email"
              />
            </div>
            <button type="submit" disabled={busy} className={cn(goldButtonClass, "mt-1")}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>

          <p className="mt-7 text-center text-[12px] leading-relaxed text-[#7a746a]">
            Still stuck?{" "}
            <a href="https://wa.me/918707368307" className="text-gold hover:text-gold-soft">
              WhatsApp support
            </a>{" "}
            or call{" "}
            <a href="tel:+918707368307" className="text-gold hover:text-gold-soft">
              +91 87073 68307
            </a>
          </p>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto mb-5.5 flex size-15 items-center justify-center rounded-full bg-gold">
            <Mail className="size-7 text-obsidian" />
          </div>
          <h2 className="mb-2 font-display text-[26px] font-semibold">
            Check your inbox
          </h2>
          <p className="mb-2 text-[13.5px] leading-relaxed text-[#7a746a]">
            We've sent a reset link to
          </p>
          <p className="mb-6 break-all text-[14px] font-semibold text-obsidian">
            {email.trim()}
          </p>
          <div className="rounded-md border border-[#efe4cc] bg-[#faf7ef] px-4 py-3 text-left text-[12.5px] leading-relaxed text-[#7a746a]">
            The link expires in <b className="text-obsidian">30 minutes</b>. If
            it doesn't arrive, check spam or resend below.
          </div>
          <button
            type="button"
            onClick={() => void send()}
            className="mt-4.5 w-full cursor-pointer rounded-[5px] border border-[#d9d0bd] bg-white px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-warm-gray transition-colors hover:bg-ivory"
          >
            Resend link
          </button>
          <Link
            to="/admin/login"
            className="mt-4.5 inline-block text-[12px] font-semibold text-gold hover:text-gold-soft"
          >
            ← Back to sign in
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
