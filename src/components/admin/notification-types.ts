import type { NotificationType } from "@/lib/notifications";

/**
 * Icon + colour + label per notification type — matches the design's `TYPE`
 * maps in `Notifications Bell.dc.html` / `Admin Notifications.dc.html`. Only
 * `booking` has a real producer today (spec 19); the rest are wired for when
 * payments/party-hall/check-in specs add one.
 */
export const TYPE_META: Record<
  NotificationType,
  { icon: string; iconBg: string; iconColor: string; label: string; cta: string }
> = {
  booking: {
    icon: "🛎",
    iconBg: "#f0e7d3",
    iconColor: "#a8863f",
    label: "New booking",
    cta: "View",
  },
  payment: {
    icon: "₹",
    iconBg: "#e6efe6",
    iconColor: "#5a8a5a",
    label: "Payment received",
    cta: "View",
  },
  party: {
    icon: "✦",
    iconBg: "#f2e0dc",
    iconColor: "#b4553f",
    label: "Party Hall enquiry",
    cta: "Quote",
  },
  checkin: { icon: "→", iconBg: "#e4eef7", iconColor: "#3a6ea5", label: "Check-in", cta: "View" },
  cancel: {
    icon: "✕",
    iconBg: "#f1f2f3",
    iconColor: "#6b7280",
    label: "Cancellation",
    cta: "View",
  },
};
