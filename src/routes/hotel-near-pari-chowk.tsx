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

const PAGE_URL = `${SITE_URL}/hotel-near-pari-chowk`;

const FAQS: FaqEntry[] = [
  {
    question: "How far is The Divine KRC from Pari Chowk?",
    answer: "The Divine KRC is a 10 minute drive from Pari Chowk, Greater Noida.",
  },
  {
    question: "Is the hotel close to Pari Chowk Metro station?",
    answer:
      "Yes — Pari Chowk Metro (Aqua Line) is a 10 minute drive from the property, giving you onward connectivity to Noida and Delhi.",
  },
  {
    question: "Is parking available at the hotel?",
    answer: "Yes, on-site parking is available for all resident guests.",
  },
  {
    question: "Can I book directly for the best rate?",
    answer:
      "Yes — book direct with The Divine KRC for the best rate, plus a complimentary breakfast.",
  },
];

export const Route = createFileRoute("/hotel-near-pari-chowk")({
  loader: () => getRoomTypesFn(),
  head: () => ({
    meta: [
      { title: "Hotel Near Pari Chowk, Greater Noida | The Divine KRC" },
      {
        name: "description",
        content:
          "Boutique rooms near Pari Chowk, Greater Noida, with easy Aqua Line metro access to Noida and Delhi. Book direct with The Divine KRC for the best rate.",
      },
      { property: "og:title", content: "Hotel Near Pari Chowk | The Divine KRC" },
      {
        property: "og:description",
        content:
          "A comfortable base near Pari Chowk, Greater Noida, minutes from the Aqua Line metro. Book direct.",
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
  component: HotelNearPariChowk,
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

function HotelNearPariChowk() {
  const roomTypes = Route.useLoaderData();
  return (
    <main className="bg-ivory text-obsidian font-sans antialiased selection:bg-gold/30 selection:text-obsidian">
      <Nav />

      {/* Hero */}
      <section
        id="top"
        className="relative min-h-[65svh] w-full bg-obsidian overflow-hidden flex flex-col justify-end"
      >
        <img
          src={heroExterior}
          alt="The Divine KRC — minutes from Pari Chowk, Greater Noida"
          width={1536}
          height={1920}
          className="absolute inset-0 size-full object-cover opacity-65 scale-[1.04] motion-safe:animate-[kenburns_18s_ease-in-out_infinite_alternate]"
        />
        <div className="absolute inset-0 bg-linear-to-t from-obsidian via-obsidian/70 to-obsidian/30" />
        <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-obsidian/80 to-transparent" />

        <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-20 md:pb-28 pt-32">
          <div className="max-w-2xl space-y-6">
            <Reveal>
              <Eyebrow>Near Pari Chowk</Eyebrow>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="font-display text-ivory text-4xl md:text-5xl lg:text-6xl leading-[1.05] text-balance">
                Your stay near <span className="italic text-gold">Pari Chowk,</span> Greater Noida.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="text-ivory/75 text-base md:text-lg font-light leading-relaxed max-w-xl">
                Minutes from Pari Chowk and its metro connectivity, The Divine KRC is a quiet,
                well-located base for NCR commuters, business travellers, and anyone passing through
                Greater Noida's commercial hub.
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
                  href="https://wa.me/918707368307?text=Hi%2C%20I%27m%20visiting%20Pari%20Chowk%20and%20would%20like%20to%20enquire%20about%20a%20stay."
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
              Why stay near Pari Chowk <span className="italic text-gold">with us.</span>
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                t: "Metro-connected, without the metro-area noise",
                d: "Close enough to Pari Chowk Metro for easy Aqua Line access to Noida and Delhi, but set back enough for a genuinely quiet night's stay.",
              },
              {
                t: "A convenient stop for NCR commuters",
                d: "Travelling through Greater Noida's commercial hub for work? Base yourself minutes from Pari Chowk instead of commuting in from further out.",
              },
              {
                t: "Breakfast on us",
                d: "Book direct and breakfast is complimentary — one less thing to plan around a busy day.",
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
              Getting to Pari Chowk Metro Station from{" "}
              <span className="italic text-gold">The Divine KRC.</span>
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-ivory/70 text-base leading-relaxed max-w-xl mb-8">
              Pari Chowk Metro (Aqua Line) is a 10 minute drive from the hotel, connecting you
              onward to Noida and Delhi. Cabs and autos are readily available from the property.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-ivory/80">
                <span className="text-gold mt-1.5 size-1 rounded-full bg-gold shrink-0" />
                By car or cab — 10 minutes to Pari Chowk
              </li>
              <li className="flex items-start gap-3 text-sm text-ivory/80">
                <span className="text-gold mt-1.5 size-1 rounded-full bg-gold shrink-0" />
                By metro — Aqua Line from Pari Chowk Metro station onward to Noida and Delhi
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
