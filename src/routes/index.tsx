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
import heroExterior from "@/assets/hero.jpg";

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
      { property: "og:image", content: heroExterior },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: heroExterior },
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
      <Rooms />
      <Amenities />
      <PartyHall />
      <Dining />
      <Landmarks />
      <Testimonials />
      <Gallery />
      <FinalCTA />
      <Footer />
    </main>
  );
}
