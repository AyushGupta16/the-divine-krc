import { createFileRoute } from "@tanstack/react-router";
import { getCalendarPageData } from "@/lib/bookings";
import { Calendar } from "@/components/admin/Calendar";

export const Route = createFileRoute("/admin/calendar")({
  loader: async () => ({ calendar: await getCalendarPageData() }),
  component: AdminCalendar,
});

function AdminCalendar() {
  const { calendar } = Route.useLoaderData();
  return <Calendar data={calendar} />;
}
