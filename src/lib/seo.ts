// Shared SEO facts (NAP + site constants) so every route's structured data
// stays in sync — see `resolveInvoiceParty`-style single-source-of-truth
// reasoning: two routes hand-rolling the same Hotel schema could drift.

export const SITE_URL = "https://thedivinekrc.in";
export const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export const hotelSchema = {
  "@context": "https://schema.org",
  "@type": "Hotel",
  name: "The Divine KRC",
  description:
    "A boutique hotel and multi-cuisine restaurant near Pari Chowk, Greater Noida. Premium rooms, signature dining, and warm Indian hospitality.",
  url: SITE_URL,
  image: OG_IMAGE,
  telephone: "+91-87073-68307",
  email: "thedivinekrc@gmail.com",
  priceRange: "₹₹",
  address: {
    "@type": "PostalAddress",
    streetAddress: "FH78+HH3, A 023, Kyampur, Sector Omicron I, Near Pari Chowk, Dadha",
    addressLocality: "Greater Noida",
    addressRegion: "Uttar Pradesh",
    postalCode: "201310",
    addressCountry: "IN",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: "28.463844253163877",
    longitude: "77.5664181629228",
  },
};

export interface FaqEntry {
  question: string;
  answer: string;
}

/** Builds a `FAQPage` JSON-LD block from the same Q&A array a page renders on-screen. */
export function faqSchema(entries: FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((e) => ({
      "@type": "Question",
      name: e.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: e.answer,
      },
    })),
  };
}
