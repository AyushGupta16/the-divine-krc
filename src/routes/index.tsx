import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/home/Nav";
import { Hero } from "@/components/home/Hero";
import { AvailabilityBar } from "@/components/home/AvailabilityBar";
import { About } from "@/components/home/About";
import { Rooms } from "@/components/home/Rooms";
import { Amenities } from "@/components/home/Amenities";
import { Dining } from "@/components/home/Dining";
import { PartyHall } from "@/components/home/PartyHall";
import { Landmarks } from "@/components/home/Landmarks";
import { Testimonials } from "@/components/home/Testimonials";
import { Gallery } from "@/components/home/Gallery";
import { FinalCTA } from "@/components/home/FinalCTA";
import { Footer } from "@/components/home/Footer";

const SITE_URL = "https://thedivinekrc.in";
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

const hotelSchema = {
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Divine KRC · Boutique Hotel & Restaurant near Pari Chowk, Greater Noida" },
      {
        name: "description",
        content:
          "An urban boutique sanctuary moments from Pari Chowk. Premium rooms, signature dining, and warm Indian hospitality in the heart of Greater Noida.",
      },
      { property: "og:title", content: "The Divine KRC · Boutique Hotel, Greater Noida" },
      {
        property: "og:description",
        content:
          "Refined rooms, signature dining and attentive service near Pari Chowk Metro, ExpoMart and Knowledge Park.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(hotelSchema),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="bg-ivory text-obsidian font-sans antialiased selection:bg-gold/30 selection:text-obsidian">
      <Nav />
      <Hero />
      <AvailabilityBar />
      <About />
      <Gallery />
      <Rooms />
      <Amenities />
      <PartyHall />
      <Dining />
      <Landmarks />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </main>
  );
}
