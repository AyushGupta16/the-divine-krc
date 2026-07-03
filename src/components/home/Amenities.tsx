import { Reveal } from "./Reveal";

const items = [
  { t: "Complimentary Wi-Fi", d: "Fast, reliable internet across the property." },
  { t: "Air-Conditioned Rooms", d: "Climate control in every guest room." },
  { t: "On-Site Restaurant", d: "Multi-cuisine dining, freshly prepared." },
  { t: "Room Service", d: "In-room dining during service hours." },
  { t: "Power Backup", d: "Uninterrupted power across the hotel." },
  { t: "On-Site Parking", d: "Convenient parking for resident guests." },
  { t: "24-Hour Front Desk", d: "A warm welcome and assistance, any time." },
  { t: "Party & Event Hall", d: "A versatile venue for up to 150 guests." },
];

export function Amenities() {
  return (
    <section id="amenities" className="bg-ivory px-6 md:px-10 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="max-w-2xl mb-16 space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <span className="text-gold text-[11px] uppercase tracking-[0.4em] font-semibold">
                Signature Amenities
              </span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl text-obsidian leading-[1.05] text-balance">
              The small details, <span className="italic text-gold">made remarkable.</span>
            </h2>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-stone-200">
          {items.map((it, i) => (
            <Reveal key={it.t} delay={i * 40} className="bg-ivory">
              <div className="p-8 h-full hover:bg-white transition-colors group">
                <div className="text-gold text-xl mb-5">✦</div>
                <h3 className="font-display text-xl text-obsidian mb-2">{it.t}</h3>
                <p className="text-sm text-warm-gray leading-relaxed">{it.d}</p>
                <div className="mt-6 h-px w-0 bg-gold group-hover:w-12 transition-all duration-500" />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
