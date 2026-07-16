import lobby from "@/assets/lobby.jpg";
import { Reveal } from "./Reveal";

const stats = [
  { v: "14", l: "Boutique Rooms" },
  { v: "8 km", l: "to ExpoMart" },
  { v: "24/7", l: "Concierge" },
  { v: "4.8★", l: "Guest Rating" },
];

export function About() {
  return (
    <section id="about" className="bg-ivory px-6 md:px-10 py-24 md:py-32 relative">
      <div className="mx-auto max-w-6xl grid md:grid-cols-12 gap-12 md:gap-16 items-center">
        <Reveal className="md:col-span-6 order-2 md:order-1">
          <div className="relative">
            <img
              src={lobby}
              alt="The Divine KRC reception with warm wood detailing"
              width={1024}
              height={1280}
              loading="lazy"
              className="w-full aspect-[4/5] object-cover"
            />
            <div className="absolute -bottom-6 -right-6 hidden md:block bg-obsidian text-ivory p-6 max-w-50">
              <div className="font-display italic text-gold text-3xl leading-none mb-2">"</div>
              <p className="text-xs leading-relaxed text-ivory/80">
                A pocket of calm in the heart of the city.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="md:col-span-6 order-1 md:order-2 space-y-6">
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <span className="text-gold text-[11px] uppercase tracking-[0.4em] font-semibold">
                The Divine KRC
              </span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display text-4xl md:text-5xl text-obsidian leading-[1.05] text-balance">
              A sanctuary in the
              <br />
              <span className="italic text-gold">heart of Greater Noida.</span>
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-warm-gray text-base leading-relaxed max-w-lg">
              The Divine KRC blends sophisticated urban design with the timeless warmth of Indian
              hospitality. Minutes from India ExpoMart, Pari Chowk Metro, and Knowledge Park, we are
              a tranquil retreat designed for the discerning traveller — business, family, or
              celebration.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 pt-6 border-t border-stone-200 mt-8 max-w-md">
              {stats.map((s) => (
                <div key={s.l}>
                  <div className="font-display text-3xl md:text-4xl text-obsidian">{s.v}</div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-warm-gray/80 mt-1">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
