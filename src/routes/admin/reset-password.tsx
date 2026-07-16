import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { AuthLayout } from "@/components/admin/AuthLayout";
import { SetPasswordForm } from "@/components/admin/SetPasswordForm";
import { resetPasswordFn } from "@/lib/auth";

const searchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/admin/reset-password")({
  validateSearch: searchSchema,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <AuthLayout
      eyebrow="Set a new password"
      title="Almost there."
      titleAccent="Choose a strong password."
      description="Use at least 8 characters with a mix of letters and numbers."
      panelFooter={
        <p className="text-[12px] leading-[1.7] text-[#8a8479]">
          This reset link is valid for 30 minutes and can be used once. You'll be signed out of
          other sessions.
        </p>
      }
    >
      <h2 className="mb-1.5 font-display text-[26px] font-semibold">New password</h2>
      <p className="mb-6 text-[13px] text-[#7a746a]">Enter and confirm your new password.</p>

      <SetPasswordForm
        submitLabel="Reset password"
        busyLabel="Updating…"
        blockedReason={token ? null : "This reset link is invalid or has expired."}
        onSubmit={async (password) => {
          const res = await resetPasswordFn({ data: { token: token!, password } });
          if (res.ok) {
            toast.success("Password updated. Sign in with your new credentials.");
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
