import partyHall from "@/assets/party-hall.jpg";
import { Reveal } from "./Reveal";

export function PartyHall() {
  return (
    <section
      id="events"
      className="bg-ivory px-6 md:px-10 py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl grid md:grid-cols-12 gap-12 md:gap-16 items-center">
        <div className="md:col-span-5 order-2 md:order-1 space-y-6">
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <span className="text-gold text-[11px] uppercase tracking-[0.4em] font-semibold">
                Events & Celebrations
              </span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display text-4xl md:text-5xl text-obsidian leading-[1.05] text-balance">
              A grand space, <span className="italic text-gold">your way.</span>
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-warm-gray text-base leading-relaxed">
              Host weddings, corporate gatherings, birthdays, and receptions in
              our spacious party hall — designed to adapt to your vision, your
              guest list, and your style.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <ul className="space-y-3 pt-2">
              {[
                "Capacity: up to 150 guests",
                "Pricing tailored to your requirements",
                "Decoration as per your theme & preference",
                "Catering & audio-visual support on request",
              ].map((x) => (
                <li key={x} className="flex items-start gap-3 text-sm text-warm-gray/80">
                  <span className="text-gold mt-1.5 size-1 rounded-full bg-gold shrink-0" />
                  {x}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={320}>
            <div className="flex flex-wrap gap-3 mt-4">
              <a
                href={`https://wa.me/918707368307?text=${encodeURIComponent(
                  "Hi Divine KRC, I'd like to enquire about the party hall. Please share availability & pricing."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gold text-obsidian text-[11px] uppercase tracking-[0.25em] font-semibold px-7 py-4 hover:bg-gold/90 transition-colors"
              >
                WhatsApp Us <span>→</span>
              </a>
              <a
                href="tel:+918707368307"
                className="inline-flex items-center gap-2 border border-gold/50 hover:border-gold text-gold text-[11px] uppercase tracking-[0.25em] px-7 py-4 font-semibold hover:bg-gold/10 transition-colors"
              >
                Call to Book
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal className="md:col-span-7 order-1 md:order-2">
          <div className="relative">
            <img
              src={partyHall}
              alt="The Divine KRC party hall — spacious event venue for up to 150 guests"
              width={1280}
              height={1280}
              loading="lazy"
              className="w-full aspect-[5/4] object-cover"
            />
            <div className="absolute -bottom-5 -right-5 hidden md:flex flex-col items-center justify-center size-28 bg-gold text-obsidian">
              <span className="font-display text-2xl leading-none">150</span>
              <span className="font-display italic text-[10px] mt-1">Guests</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
