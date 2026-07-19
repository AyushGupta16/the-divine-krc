// Shared between the marketing AvailabilityBar and the guest booking flow's
// arrival/departure time-of-day pickers.

import { format } from "date-fns";

export const TIME_SLOTS = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

export function formatTimeLabel(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return format(new Date(2000, 0, 1, h, m), "h:mm a");
}
