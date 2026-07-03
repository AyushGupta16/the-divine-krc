import restaurant from "@/assets/restaurant.jpg";
import { Reveal } from "./Reveal";

export function Dining() {
  return (
    <section
      id="dining"
      className="bg-obsidian text-ivory px-6 md:px-10 py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl grid md:grid-cols-12 gap-12 md:gap-16 items-center">
        <Reveal className="md:col-span-7">
          <div className="relative">
            <img
              src={restaurant}
              alt="The Divine KRC restaurant interior with warm lighting"
              width={1280}
              height={1280}
              loading="lazy"
              className="w-full aspect-[5/4] object-cover"
            />
            <div className="absolute -bottom-5 -left-5 hidden md:flex flex-col items-center justify-center size-28 bg-gold text-obsidian">
              <span className="font-display italic text-xs">Open</span>
              <span className="font-display text-2xl leading-none mt-1">7am</span>
              <span className="font-display italic text-[10px] mt-1">— 11pm</span>
            </div>
          </div>
        </Reveal>

        <div className="md:col-span-5 space-y-6">
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <span className="text-gold text-[11px] uppercase tracking-[0.4em] font-semibold">
                The Restaurant
              </span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.05] text-balance">
              A table, <span className="italic text-gold">always set for you.</span>
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-ivory/70 text-base leading-relaxed">
              From regional Indian classics to global comfort, our in-house
              kitchen is led by a chef devoted to seasonal produce, attentive
              service, and unhurried meals. Breakfast on us when you book direct.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <ul className="space-y-3 pt-2">
              {["Live breakfast bar · 7am – 10:30am", "All-day à la carte menu", "Private dining for up to 14"].map((x) => (
                <li key={x} className="flex items-start gap-3 text-sm text-ivory/80">
                  <span className="text-gold mt-1.5 size-1 rounded-full bg-gold shrink-0" />
                  {x}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={320}>
            <a
              href="#book"
              className="inline-flex items-center gap-3 mt-4 border border-gold/50 hover:border-gold text-gold text-[11px] uppercase tracking-[0.25em] px-7 py-4 font-semibold hover:bg-gold/10 transition-colors"
            >
              Explore Menu <span>→</span>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
