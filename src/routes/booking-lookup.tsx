import { createFileRoute } from "@tanstack/react-router";
import { BookingLookup } from "@/components/booking/BookingLookup";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";

const PAGE_URL = `${SITE_URL}/booking-lookup`;

export const Route = createFileRoute("/booking-lookup")({
  head: () => ({
    meta: [
      { title: "Manage Your Booking | The Divine KRC" },
      {
        name: "description",
        content:
          "Look up an existing reservation at The Divine KRC, Greater Noida — check your booking details, status, and invoice.",
      },
      { property: "og:title", content: "Manage Your Booking | The Divine KRC" },
      {
        property: "og:description",
        content:
          "Look up an existing reservation at The Divine KRC, Greater Noida — check your booking details, status, and invoice.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: BookingLookup,
});
