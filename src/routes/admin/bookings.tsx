import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { bookingsPage } from "@/lib/bookings-data";
import { Bookings } from "@/components/admin/Bookings";
import { useEntryForms } from "@/components/admin/entry-forms-context";

// The router's default search codec round-trips a `<Link search={{ new:
// "1" }}>` navigation correctly (it JSON-stringifies "1" to `%221%22`, so
// JSON.parse hands the string back), but a *raw* URL — typed, bookmarked,
// or reconstructed by the auth guard's post-login `redirect=` — carries the
// plain `?new=1`, and the router's own query decoder (`qss`'s `toValue`)
// coerces that bare digit to the *number* `1`, not the string. The original
// `z.literal("1")` rejected that shape outright and threw out of
// `validateSearch`, taking the whole route down.
//
// `validateSearch` is not called exactly once per navigation — confirmed by
// instrumenting it directly: one call receives the raw parsed URL value,
// several subsequent calls receive `true`, the *previous call's output*,
// as if re-validating it as fresh input. A `.transform()` that changes the
// value's type ("1"/1 -> true) is therefore not safe here — accepting `true`
// as a valid input too (in addition to "1" and 1) is what makes re-running
// the schema against its own prior output a no-op instead of a throw.
const flagParam = z
  .union([z.literal("1"), z.literal(1), z.literal(true)])
  .transform(() => true as const)
  .optional();

const searchSchema = z.object({
  new: flagParam,
  guest: z.string().optional(),
  unassigned: flagParam,
});

export const Route = createFileRoute("/admin/bookings")({
  validateSearch: searchSchema,
  loader: async () => ({ data: await bookingsPage() }),
  component: AdminBookings,
});

function AdminBookings() {
  const { data } = Route.useLoaderData();
  const { new: openEntry, guest, unassigned } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { openBooking } = useEntryForms();

  // `?new=1` deep-links the booking Sheet open. The param is dropped from
  // the URL (replace, not push) the same tick it's consumed rather than
  // left sitting there: a ref guard would only last the life of this
  // component instance, so navigating away and back (browser history, or
  // any remount) would find the URL still carrying `new=1` and re-open the
  // Sheet on a state change that has nothing to do with it. Clearing the
  // param is the only version of "fire once" that survives a remount.
  useEffect(() => {
    if (!openEntry) return;
    openBooking();
    void navigate({
      search: (prev) => ({ guest: prev.guest, unassigned: prev.unassigned }),
      replace: true,
    });
  }, [openEntry, openBooking, navigate]);

  return <Bookings data={data} guestFilter={guest} unassignedOnly={!!unassigned} />;
}
