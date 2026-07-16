import { Reveal } from "./Reveal";

const places = [
  { t: "India ExpoMart", d: "Global trade & exhibitions", dist: "15 min drive" },
  { t: "Pari Chowk Metro", d: "Aqua Line · NCR connectivity", dist: "10 min drive" },
  { t: "Gautam Buddha University", d: "Knowledge Park III", dist: "15 min drive" },
  { t: "Sharda University", d: "Knowledge Park II", dist: "15 min drive" },
  { t: "Grand Venice Mall", d: "Shopping & leisure", dist: "5 min drive" },
  { t: "Jewar Airport (NIA)", d: "International Airport and Hub", dist: "45 min drive" },
];

export function Landmarks() {
  return (
    <section id="location" className="bg-ivory px-6 md:px-10 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid md:grid-cols-12 gap-10 md:gap-16 mb-14 md:mb-20 items-end">
          <Reveal className="md:col-span-5">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-gold" />
                <span className="text-gold text-[11px] uppercase tracking-[0.4em] font-semibold">
                  The Location
                </span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl text-obsidian leading-[1.05] text-balance">
                At the centre of <span className="italic text-gold">everything.</span>
              </h2>
            </div>
          </Reveal>
          <Reveal delay={120} className="md:col-span-7">
            <p className="text-warm-gray text-base leading-relaxed max-w-xl">
              Stay steps from Greater Noida's business, academic, and cultural landmarks — and
              minutes from the metro that connects you to the rest of the NCR.
            </p>
          </Reveal>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-stone-200">
          {places.map((p, i) => (
            <Reveal key={p.t} delay={i * 50} className="bg-ivory">
              <div className="p-8 h-full hover:bg-white transition-colors flex flex-col justify-between gap-8 group">
                <div className="flex items-start justify-between">
                  <span className="font-display text-gold/40 text-2xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-gold text-lg">✦</span>
                </div>
                <div>
                  <h3 className="font-display text-2xl text-obsidian mb-1.5">{p.t}</h3>
                  <p className="text-sm text-warm-gray mb-4">{p.d}</p>
                  <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.25em] text-warm-gray/70">
                    <span className="h-px w-6 bg-gold group-hover:w-10 transition-all duration-500" />
                    {p.dist}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
