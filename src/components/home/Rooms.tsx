import roomBalcony from "@/assets/room-balcony.jpg";
import roomDeluxe from "@/assets/room-deluxe.jpg";
import { Reveal } from "./Reveal";

const PHONE = "+918707368307";
const WHATSAPP = `https://wa.me/918707368307?text=${encodeURIComponent(
  "Hi Divine KRC, I'd like to book a room. Please share availability.",
)}`;

const rooms = [
  {
    img: roomBalcony,
    name: "Deluxe Room with Balcony",
    size: "26 m²",
    price: "₹1,700",
    note: "Private balcony · King bed",
  },
  {
    img: roomDeluxe,
    name: "Classic Room",
    size: "24 m²",
    price: "₹1,500",
    note: "Quiet wing · King bed",
  },
];

export function Rooms() {
  return (
    <section id="rooms" className="bg-obsidian text-ivory px-6 md:px-10 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14 md:mb-20">
          <Reveal>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-gold" />
                <span className="text-gold text-[11px] uppercase tracking-[0.4em] font-semibold">
                  The Collection
                </span>
              </div>
              <h2 className="font-display text-4xl md:text-5xl text-balance">
                Refined living, <span className="italic text-gold">thoughtfully composed.</span>
              </h2>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="flex flex-wrap items-center gap-3 self-start md:self-end">
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gold text-obsidian text-[11px] uppercase tracking-[0.25em] font-semibold px-6 py-3.5 hover:bg-gold/90 transition-colors"
              >
                WhatsApp Us <span>→</span>
              </a>
              <a
                href={`tel:${PHONE}`}
                className="inline-flex items-center gap-2 border border-gold/50 text-gold text-[11px] uppercase tracking-[0.25em] font-semibold px-6 py-3.5 hover:bg-gold/10 hover:border-gold transition-colors"
              >
                Book Direct
              </a>
            </div>
          </Reveal>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-14 max-w-3xl mx-auto">
          {rooms.map((r, i) => (
            <Reveal key={r.name} delay={i * 80}>
              <article className="group cursor-pointer">
                <div className="relative overflow-hidden mb-5 aspect-[4/5] bg-white/5">
                  <img
                    src={r.img}
                    alt={`${r.name} at The Divine KRC`}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-obsidian/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.25em] text-gold bg-obsidian/70 backdrop-blur-sm px-3 py-1.5">
                    {r.size}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-display text-2xl">{r.name}</h3>
                  <p className="text-[11px] text-ivory/50 uppercase tracking-[0.18em]">{r.note}</p>
                  <div className="flex items-end justify-between pt-3">
                    <div>
                      <div className="text-[10px] text-ivory/40 uppercase tracking-[0.25em]">
                        From
                      </div>
                      <div className="font-display text-xl text-gold">
                        {r.price}
                        <span className="text-ivory/40 text-xs ml-1">/ night</span>
                      </div>
                    </div>
                    <span className="text-gold text-[11px] uppercase tracking-[0.22em] border-b border-gold/40 pb-0.5 group-hover:border-gold transition-colors">
                      Details →
                    </span>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
