import { createFileRoute } from "@tanstack/react-router";
import { PartyHallEnquiry } from "@/components/booking/PartyHallEnquiry";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";

const PAGE_URL = `${SITE_URL}/party-hall-enquiry`;

export const Route = createFileRoute("/party-hall-enquiry")({
  head: () => ({
    meta: [
      { title: "Party Hall Enquiry | The Divine KRC" },
      {
        name: "description",
        content:
          "Enquire about hosting your celebration at The Divine KRC's banquet hall in Greater Noida — get a quote for your event.",
      },
      { property: "og:title", content: "Party Hall Enquiry | The Divine KRC" },
      {
        property: "og:description",
        content:
          "Enquire about hosting your celebration at The Divine KRC's banquet hall in Greater Noida — get a quote for your event.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: PartyHallEnquiry,
});
