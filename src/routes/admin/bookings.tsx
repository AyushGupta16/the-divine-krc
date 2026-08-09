import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { bookingsPage } from "@/lib/bookings-data";
import { Bookings } from "@/components/admin/Bookings";
import { useEntryForms } from "@/components/admin/entry-forms-context";

const searchSchema = z.object({
  new: z.literal("1").optional(),
  guest: z.string().optional(),
  unassigned: z.literal("1").optional(),
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
    if (openEntry !== "1") return;
    openBooking();
    void navigate({ search: (prev) => ({ ...prev, new: undefined }), replace: true });
  }, [openEntry, openBooking, navigate]);

  return <Bookings data={data} guestFilter={guest} unassignedOnly={unassigned === "1"} />;
}
