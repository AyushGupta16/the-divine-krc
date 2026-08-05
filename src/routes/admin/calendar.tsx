import { createFileRoute } from "@tanstack/react-router";
import { calendarPage } from "@/lib/bookings-data";
import { normalizeCalendarSearch } from "@/lib/bookings";
import { Calendar } from "@/components/admin/Calendar";

export const Route = createFileRoute("/admin/calendar")({
  validateSearch: (search: Record<string, unknown>) => normalizeCalendarSearch(search),
  loaderDeps: ({ search }) => ({ year: search.year, month: search.month }),
  loader: async ({ deps }) => ({
    calendar: await calendarPage({ data: { year: deps.year, month: deps.month } }),
  }),
  component: AdminCalendar,
});

function AdminCalendar() {
  const { calendar } = Route.useLoaderData();
  const { year, month } = Route.useSearch();
  return <Calendar data={calendar} year={year} month={month} />;
}
