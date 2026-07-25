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
import { ScrollDial } from "@/components/home/ScrollDial";
import { getRoomTypesFn } from "@/lib/bookings-data";
import { SITE_URL, OG_IMAGE, hotelSchema } from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: () => getRoomTypesFn(),
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
  const roomTypes = Route.useLoaderData();
  return (
    <main className="bg-ivory text-obsidian font-sans antialiased selection:bg-gold/30 selection:text-obsidian">
      <Nav />
      <Hero />
      <AvailabilityBar />
      <About />
      <Gallery />
      <Rooms roomTypes={roomTypes} />
      <Amenities />
      <PartyHall />
      <Dining />
      <Landmarks />
      <Testimonials />
      <FinalCTA />
      <Footer />
      <ScrollDial />
    </main>
  );
}
