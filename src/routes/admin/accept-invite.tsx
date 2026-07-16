import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { AuthLayout } from "@/components/admin/AuthLayout";
import { SetPasswordForm } from "@/components/admin/SetPasswordForm";
import { acceptInviteFn, getInviteFn } from "@/lib/invites";

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

  const dead = "This invite link is invalid or has expired. Ask for a new one.";

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

      <Link
        to="/admin/login"
        className="mt-5.5 inline-block text-[12px] font-semibold text-gold hover:text-gold-soft"
      >
        ← Back to sign in
      </Link>
    </AuthLayout>
  );
}
