import heroExterior from "@/assets/hero.jpg";

export function Hero() {
  return (
    <section
      id="top"
      className="relative min-h-[100svh] w-full bg-obsidian overflow-hidden flex flex-col justify-end"
    >
      <img
        src={heroExterior}
        alt="The Divine KRC boutique hotel exterior at dusk"
        width={1536}
        height={1920}
        className="absolute inset-0 size-full object-cover opacity-65 scale-[1.04] motion-safe:animate-[kenburns_18s_ease-in-out_infinite_alternate]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/70 to-obsidian/30" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-obsidian/80 to-transparent" />

      <div className="relative z-10 mx-auto max-w-7xl w-full px-6 md:px-10 pb-28 md:pb-40 pt-32">
        <div className="max-w-2xl space-y-6">
          <div className="flex items-center gap-3">
            <span className="h-px w-10 bg-gold" />
            <span className="text-gold text-[10px] md:text-[11px] uppercase tracking-[0.4em] font-semibold">
              Banquet Hotel · Greater Noida
            </span>
          </div>
          <h1 className="font-display text-ivory text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] leading-[1.02] italic text-balance">
            Urban Serenity,
            <br />
            <span className="text-gold not-italic">Regal Comfort.</span>
          </h1>
          <p className="text-ivory/75 text-base md:text-lg font-light leading-relaxed max-w-xl">
            A refined boutique sanctuary moments from Pari Chowk — where the rhythm of Greater Noida
            meets timeless, attentive hospitality.
          </p>
          <div className="flex flex-wrap items-center gap-5 pt-2">
            <a
              href="/book"
              className="inline-flex items-center bg-gold text-obsidian text-[11px] uppercase tracking-[0.25em] px-7 py-4 font-semibold hover:bg-gold-soft transition-colors"
            >
              Reserve Your Stay
            </a>
            <a
              href="#rooms"
              className="group inline-flex items-center gap-3 text-ivory text-[11px] uppercase tracking-[0.25em]"
            >
              <span className="border-b border-gold/60 pb-1 group-hover:border-gold transition-colors">
                Explore Rooms
              </span>
              <span className="text-gold transition-transform group-hover:translate-x-1">→</span>
            </a>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 md:right-10 z-10 hidden sm:flex flex-col items-center gap-3 text-ivory/50 text-[9px] uppercase tracking-[0.3em] writing-mode-vertical">
        <span className="h-10 w-px bg-gold/40 motion-safe:animate-pulse" />
        <span>Scroll</span>
      </div>

      <style>{`
        @keyframes kenburns {
          0% { transform: scale(1.04) translate3d(0,0,0); }
          100% { transform: scale(1.12) translate3d(-1%, -1%, 0); }
        }
      `}</style>
    </section>
  );
}
