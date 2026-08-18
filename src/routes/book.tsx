import { createFileRoute } from "@tanstack/react-router";
import { Book } from "@/components/booking/Book";
import { getAddOnRatesFn, getRoomTypesFn } from "@/lib/bookings-data";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";

const PAGE_URL = `${SITE_URL}/book`;

export const Route = createFileRoute("/book")({
  // Same source the homepage/landmark pages use (#66/#67 follow-up): a rate
  // or name edited in the admin Settings screen must show up here too, not
  // just on the marketing pages — a guest should never be quoted a stale
  // price the front desk already changed. Add-on rates (Slice B) follow the
  // same rule.
  loader: () => Promise.all([getRoomTypesFn(), getAddOnRatesFn()]),
  head: () => ({
    meta: [
      { title: "Book Direct | The Divine KRC, Greater Noida" },
      {
        name: "description",
        content:
          "Book your stay directly with The Divine KRC in Greater Noida for the best rate, plus a complimentary breakfast. Reserve directly in a few clicks.",
      },
      { property: "og:title", content: "Book Direct | The Divine KRC" },
      {
        property: "og:description",
        content:
          "Book your stay directly with The Divine KRC in Greater Noida for the best rate, plus a complimentary breakfast.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const [roomTypes, addOnRates] = Route.useLoaderData();
  return <Book roomTypes={roomTypes} addOnRates={addOnRates} />;
}
