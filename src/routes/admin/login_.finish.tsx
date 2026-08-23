import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { AuthLayout } from "@/components/admin/AuthLayout";
import { googleFinishFn } from "@/lib/auth";

// `login_.finish` — sits under /admin/login without nesting inside the login
// page's own component, matching the `settings_.invite` pattern. Landed on
// after the Netlify OAuth callback redirects here with a one-shot token; this
// route's only job is to hand that token to `googleFinishFn` (which runs
// inside the main app, with a real h3 event, and mints the actual session
// cookie) and then continue to the console or back to an error state.
export const Route = createFileRoute("/admin/login_/finish")({
  validateSearch: z.object({ token: z.string().optional() }),
  component: LoginFinish,
});

function LoginFinish() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const ranRef = useRef(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!token) {
      navigate({ to: "/admin/login", search: { error: "oauth_failed" } });
      return;
    }

    void (async () => {
      const res = await googleFinishFn({ data: { token } });
      if (res.ok) {
        await router.invalidate();
        navigate({ to: "/admin" });
      } else {
        setError(res.error);
      }
    })();
  }, [token, navigate, router]);

  useEffect(() => {
    if (error) navigate({ to: "/admin/login", search: { error } });
  }, [error, navigate]);

  return (
    <AuthLayout
      eyebrow="Admin console"
      title="Signing you in,"
      titleAccent="one moment."
      description="Finishing Google sign-in for The Divine KRC admin console."
    >
      <p className="text-[13px] text-[#7a746a]">Please wait…</p>
    </AuthLayout>
  );
}
