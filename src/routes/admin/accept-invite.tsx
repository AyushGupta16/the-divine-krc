import { useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthLayout } from "@/components/admin/AuthLayout";
import { GoogleIcon } from "@/components/admin/GoogleIcon";
import { SetPasswordForm } from "@/components/admin/SetPasswordForm";
import { acceptInviteFn, getInviteFn, googleAcceptInviteFn } from "@/lib/invites";

const searchSchema = z.object({
  token: z.string().optional(),
});

// Public, like the other token screens: the person accepting has no account
// yet, so gating this would lock out exactly who it is for. The token is the
// proof, and `acceptInviteFn` re-checks it server-side — the loader below only
// decides what to render.
export const Route = createFileRoute("/admin/accept-invite")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ deps }) => {
    if (!deps.token) return { invite: null as { email: string } | null };
    const res = await getInviteFn({ data: { token: deps.token } });
    return { invite: res.ok ? { email: res.email } : null };
  },
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const { invite } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const dead = "This invite link is invalid or has expired. Ask for a new one.";

  async function google() {
    if (!token) return;
    setGoogleBusy(true);
    setGoogleError(null);
    const res = await googleAcceptInviteFn({ data: { token } });
    if (!res.ok) {
      setGoogleBusy(false);
      setGoogleError(res.error);
      return;
    }
    await router.invalidate();
    setGoogleBusy(false);
    toast.success("You're on the team.");
    void navigate({ to: "/admin" });
  }

  return (
    <AuthLayout
      eyebrow="Join the team"
      title="Welcome to KRC."
      titleAccent="Set a password to finish."
      description="Choose a password and your account is live. Your access is set by the role you were invited into."
      panelFooter={
        <p className="text-[12px] leading-[1.7] text-[#8a8479]">
          This invite is valid for 7 days and can be used once. If it has lapsed, ask an owner or
          manager to re-invite you.
        </p>
      }
    >
      <h2 className="mb-1.5 font-display text-[26px] font-semibold">Set your password</h2>
      <p className="mb-6 text-[13px] text-[#7a746a]">
        {invite ? (
          <>
            You're joining as <span className="font-semibold text-obsidian">{invite.email}</span>.
          </>
        ) : (
          "Use at least 8 characters with a mix of letters and numbers."
        )}
      </p>

      <SetPasswordForm
        submitLabel="Join the team"
        busyLabel="Setting up…"
        blockedReason={invite ? null : dead}
        onSubmit={async (password) => {
          const res = await acceptInviteFn({ data: { token: token!, password } });
          if (res.ok) {
            toast.success("You're on the team. Sign in to get started.");
            void navigate({ to: "/admin/login" });
          }
          return res;
        }}
      />

      {invite && (
        <>
          <div className="my-3 flex items-center gap-2.5 text-[10.5px] uppercase tracking-[0.14em] text-[#a49d8d]">
            <span className="h-px flex-1 bg-[#eae4d6]" />
            or
            <span className="h-px flex-1 bg-[#eae4d6]" />
          </div>

          {googleError && (
            <div className="mb-3.5 flex items-center gap-2.5 rounded-md border border-[#e6cbc2] bg-[#f7e6e0] px-3.5 py-2.5">
              <AlertCircle className="size-4 shrink-0 text-[#b4553f]" />
              <span className="text-[12.5px] font-medium text-[#b4553f]">{googleError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => void google()}
            disabled={googleBusy}
            className="flex w-full items-center justify-center gap-3 rounded-[5px] border border-[#e5ddcb] bg-white px-4 py-3 text-[13px] font-semibold text-[#2a2a2a] transition-colors hover:bg-ivory disabled:opacity-60"
          >
            <GoogleIcon />
            {googleBusy ? "Joining…" : "Continue with Google"}
          </button>
        </>
      )}

      <Link
        to="/admin/login"
        className="mt-5.5 inline-block text-[12px] font-semibold text-gold hover:text-gold-soft"
      >
        ← Back to sign in
      </Link>
    </AuthLayout>
  );
}
