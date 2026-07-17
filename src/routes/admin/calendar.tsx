import { createFileRoute } from "@tanstack/react-router";
import { calendarPage } from "@/lib/bookings-data";
import { Calendar } from "@/components/admin/Calendar";

export const Route = createFileRoute("/admin/calendar")({
  loader: async () => ({ calendar: await calendarPage() }),
  component: AdminCalendar,
});

function AdminCalendar() {
  const { calendar } = Route.useLoaderData();
  return <Calendar data={calendar} />;
}
