import g1 from "@/assets/room-suite.jpg";
import g2 from "@/assets/lobby.jpg";
import g3 from "@/assets/gallery-dining.jpg";
import g4 from "@/assets/room-balcony.jpg";
import g5 from "@/assets/gallery-reception.jpg";
import g6 from "@/assets/room-twin.jpg";
import { Reveal } from "./Reveal";

const items = [
  { src: g1, alt: "Executive suite", span: "row-span-2 col-span-2" },
  { src: g2, alt: "Hotel lobby", span: "" },
  { src: g3, alt: "Daytime façade", span: "" },
  { src: g4, alt: "Balcony studio", span: "col-span-2" },
  { src: g5, alt: "Reception desk", span: "" },
  { src: g6, alt: "Twin room", span: "" },
];

export function Gallery() {
  return (
    <section id="gallery" className="bg-ivory px-6 md:px-10 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 md:mb-16">
          <Reveal>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-gold" />
                <span className="text-gold text-[11px] uppercase tracking-[0.4em] font-semibold">
                  Gallery
                </span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl text-obsidian leading-[1.05] text-balance">
                A glimpse <span className="italic text-gold">inside.</span>
              </h2>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <a
              href="#gallery"
              className="text-[11px] uppercase tracking-[0.25em] text-obsidian border-b border-gold pb-1"
            >
              View Full Gallery →
            </a>
          </Reveal>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[140px] md:auto-rows-[200px] gap-3">
          {items.map((it, i) => (
            <Reveal key={i} delay={i * 60} className={`overflow-hidden ${it.span}`}>
              <img
                src={it.src}
                alt={it.alt}
                loading="lazy"
                className="size-full object-cover hover:scale-[1.05] transition-transform duration-[1200ms] ease-out"
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
