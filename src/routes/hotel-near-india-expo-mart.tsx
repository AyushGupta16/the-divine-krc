import { createFileRoute } from "@tanstack/react-router";

import { Nav } from "@/components/home/Nav";
import { Reveal } from "@/components/home/Reveal";
import { ScrollDial } from "@/components/home/ScrollDial";
import { FinalCTA } from "@/components/home/FinalCTA";
import { Footer } from "@/components/home/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroExterior from "@/assets/hero.jpg";
import { getRoomTypesFn } from "@/lib/bookings-data";
import { DEFAULT_ROOM_IMAGE, ROOM_IMAGES } from "@/lib/room-images";
import { SITE_URL, OG_IMAGE, hotelSchema, faqSchema, type FaqEntry } from "@/lib/seo";

const PAGE_URL = `${SITE_URL}/hotel-near-india-expo-mart`;

const FAQS: FaqEntry[] = [
  {
    question: "How far is The Divine KRC from India Expo Mart?",
    answer: "The Divine KRC is a 15 minute drive from India Expo Mart, Greater Noida.",
  },
  {
    question: "Is parking available for Expo Mart visitors?",
    answer:
      "Yes — on-site parking is available for resident guests staying at The Divine KRC during an Expo Mart visit.",
  },
  {
    question: "Can I book multiple nights for an Expo Mart event?",
    answer:
      "Yes, multi-night stays are welcome — book direct for the best rate and a complimentary breakfast.",
  },
];

export const Route = createFileRoute("/hotel-near-india-expo-mart")({
  loader: () => getRoomTypesFn(),
  head: () => ({
    meta: [
      { title: "Hotel Near India Expo Mart, Greater Noida | The Divine KRC" },
      {
        name: "description",
        content:
          "Boutique rooms and easy access to India Expo Mart, Greater Noida — 15 min by road. Book direct with The Divine KRC for the best rate and a personal welcome.",
      },
      { property: "og:title", content: "Hotel Near India Expo Mart | The Divine KRC" },
      {
        property: "og:description",
        content:
          "A quiet, comfortable base 15 minutes from India Expo Mart, Greater Noida. Book direct.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(hotelSchema) },
      { type: "application/ld+json", children: JSON.stringify(faqSchema(FAQS)) },
    ],
  }),
  component: HotelNearIndiaExpoMart,
});

function Eyebrow({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="h-px w-10 bg-gold" />
      <span className="text-gold text-[11px] uppercase tracking-[0.4em] font-semibold">
        {children}
      </span>
    </div>
  );
}

function HotelNearIndiaExpoMart() {
  const roomTypes = Route.useLoaderData();
  return (
    <main className="bg-ivory text-obsidian font-sans antialiased selection:bg-gold/30 selection:text-obsidian">
      <Nav />

      {/* Hero — full-bleed image + gradient overlay, same treatment as the homepage Hero, at a
          reduced ~65svh height since this is a landing page and the content below should be
          reachable faster than on the homepage. */}
      <section
        id="top"
        className="relative min-h-[65svh] w-full bg-obsidian overflow-hidden flex flex-col justify-end"
      >
        <img
          src={heroExterior}
          alt="The Divine KRC — a short drive from India Expo Mart, Greater Noida"
          width={1536}
          height={1920}
          className="absolute inset-0 size-full object-cover opacity-65 scale-[1.04] motion-safe:animate-[kenburns_18s_ease-in-out_infinite_alternate]"
        />
        <div className="absolute inset-0 bg-linear-to-t from-obsidian via-obsidian/70 to-obsidian/30" />
        <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-obsidian/80 to-transparent" />

        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 md:pb-28 pt-32">
          <div className="max-w-2xl space-y-6">
            <Reveal>
              <Eyebrow>Near India Expo Mart</Eyebrow>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="font-display text-ivory text-4xl md:text-5xl lg:text-6xl leading-[1.05] text-balance">
                Your stay near <span className="italic text-gold">India Expo Mart,</span> Greater
                Noida.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="text-ivory/75 text-base md:text-lg font-light leading-relaxed max-w-xl">
                Whether you're exhibiting, attending, or organizing an event at India Expo Mart,
                Greater Noida, The Divine KRC is a quiet, comfortable base just 15 minutes away.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <a
                  href="/book"
                  className="inline-flex items-center bg-gold text-obsidian text-[11px] uppercase tracking-[0.25em] font-semibold px-7 py-4 hover:bg-gold-soft transition-colors"
                >
                  Reserve Your Stay
                </a>
                <a
                  href="https://wa.me/918707368307?text=Hi%2C%20I%27m%20visiting%20India%20Expo%20Mart%20and%20would%20like%20to%20enquire%20about%20a%20stay."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-gold/50 text-gold text-[11px] uppercase tracking-[0.25em] font-semibold px-7 py-4 hover:bg-gold/10 hover:border-gold transition-colors"
                >
                  WhatsApp Us
                </a>
              </div>
            </Reveal>
          </div>
        </div>

        <style>{`
          @keyframes kenburns {
            0% { transform: scale(1.04) translate3d(0,0,0); }
            100% { transform: scale(1.12) translate3d(-1%, -1%, 0); }
          }
        `}</style>
      </section>

      {/* Why stay here */}
      <section className="bg-ivory px-6 md:px-10 py-24 md:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <Eyebrow>Why The Divine KRC</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl text-obsidian leading-[1.1] text-balance mb-10">
              Why stay near India Expo Mart <span className="italic text-gold">with us.</span>
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                t: "Built for multi-night stays",
                d: "Exhibitors and event attendees often need several nights in a row — book direct for the best rate across your whole stay.",
              },
              {
                t: "A quiet room after a long event day",
                d: "Expo Mart days run long. Come back to a calm, comfortable room minutes away instead of fighting NCR traffic to get further out.",
              },
              {
                t: "Breakfast on us",
                d: "Book direct and breakfast is complimentary — one less thing to plan around a packed event schedule.",
              },
            ].map((item, i) => (
              <Reveal key={item.t} delay={i * 80}>
                <h3 className="font-display text-xl text-obsidian mb-2">{item.t}</h3>
                <p className="text-warm-gray text-sm leading-relaxed">{item.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Distance & how to reach */}
      <section className="bg-obsidian text-ivory px-6 md:px-10 py-24 md:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <Eyebrow>Getting Here</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl leading-[1.1] text-balance mb-4">
              Getting to India Expo Mart from{" "}
              <span className="italic text-gold">Greater Noida.</span>
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-ivory/70 text-base leading-relaxed max-w-xl mb-8">
              The Divine KRC is a 15 minute drive from India Expo Mart. Cabs and autos are readily
              available from the hotel; Pari Chowk Metro (Aqua Line) is a 10 minute drive from the
              property for onward NCR connectivity.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-ivory/80">
                <span className="text-gold mt-1.5 size-1 rounded-full bg-gold shrink-0" />
                By car or cab — 15 minutes to India Expo Mart
              </li>
              <li className="flex items-start gap-3 text-sm text-ivory/80">
                <span className="text-gold mt-1.5 size-1 rounded-full bg-gold shrink-0" />
                By metro — 10 minutes to Pari Chowk Metro (Aqua Line), then onward by cab
              </li>
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Rooms at a glance */}
      <section className="bg-ivory px-6 md:px-10 py-24 md:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <Eyebrow>Rooms</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl text-obsidian leading-[1.1] text-balance mb-10">
              Rooms at a <span className="italic text-gold">glance.</span>
            </h2>
          </Reveal>
          <div className="mx-auto max-w-3xl">
            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              {roomTypes.map((r, i) => (
                <Reveal key={r.type} delay={i * 80}>
                  <a href="/#rooms" className="group block">
                    <div className="relative overflow-hidden mb-3 aspect-4/3">
                      <img
                        src={ROOM_IMAGES[r.type] ?? DEFAULT_ROOM_IMAGE}
                        alt={`${r.name} at The Divine KRC`}
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-1200 ease-out group-hover:scale-[1.06]"
                      />
                      <div className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.25em] text-gold bg-obsidian/70 backdrop-blur-sm px-3 py-1.5">
                        {r.areaSqm} m²
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <h3 className="font-display text-xl text-obsidian">{r.name}</h3>
                      <div className="text-right">
                        <div className="text-[10px] text-warm-gray uppercase tracking-[0.25em]">
                          From
                        </div>
                        <span className="font-display text-lg text-gold">
                          ₹{r.pricePerNight.toLocaleString("en-IN")}/night
                        </span>
                      </div>
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
            <Reveal>
              <a
                href="/#rooms"
                className="inline-flex items-center gap-2 text-gold text-[11px] uppercase tracking-[0.25em] font-semibold border-b border-gold/40 hover:border-gold transition-colors pb-0.5"
              >
                See all rooms →
              </a>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-obsidian text-ivory px-6 md:px-10 py-24 md:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl leading-[1.1] text-balance mb-10">
              Frequently asked <span className="italic text-gold">questions.</span>
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <Accordion type="single" collapsible className="mx-auto max-w-3xl">
              {FAQS.map((f, i) => (
                <AccordionItem key={f.question} value={`item-${i}`} className="border-ivory/15">
                  <AccordionTrigger className="text-ivory hover:no-underline hover:text-gold text-base font-display">
                    {f.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-ivory/70 text-sm leading-relaxed">
                    {f.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      {/* Map */}
      <section className="bg-ivory px-6 md:px-10 py-24 md:py-32">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <Eyebrow>Location</Eyebrow>
            <h2 className="font-display text-3xl md:text-4xl text-obsidian leading-[1.1] text-balance mb-10">
              Find us on the <span className="italic text-gold">map.</span>
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <iframe
              title="The Divine KRC location map"
              src="https://www.google.com/maps?q=28.463844253163877,77.5664181629228&z=15&output=embed"
              width="100%"
              height="420"
              loading="lazy"
              className="mx-auto block border-0 max-w-3xl"
            />
          </Reveal>
        </div>
      </section>

      <FinalCTA />
      <Footer />
      <ScrollDial />
    </main>
  );
}
