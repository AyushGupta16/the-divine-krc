import { Reveal } from "./Reveal";

const quotes = [
  {
    q: "A pocket of calm right in the middle of the city. The room was exquisite and the staff anticipated every need.",
    n: "Aarav Mehta",
    r: "Business traveller · Mumbai",
  },
  {
    q: "We hosted our daughter's wedding reception here. The team turned an ordinary banquet into a regal memory.",
    n: "The Sharma Family",
    r: "Wedding guests · Delhi",
  },
  {
    q: "The closest premium stay to Sharda University with hospitality that genuinely cares. Our go-to in Greater Noida.",
    n: "Dr. Priya Khanna",
    r: "Visiting Faculty · Bengaluru",
  },
];

export function Testimonials() {
  return (
    <section className="bg-obsidian text-ivory px-6 md:px-10 py-24 md:py-32 relative overflow-hidden">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <div className="max-w-2xl mb-14 md:mb-20 space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <span className="text-gold text-[11px] uppercase tracking-[0.4em] font-semibold">
                Guest Voices
              </span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl text-balance">
              Told best by <span className="italic text-gold">those who stayed.</span>
            </h2>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-8 md:gap-10">
          {quotes.map((t, i) => (
            <Reveal key={t.n} delay={i * 100}>
              <figure className="border border-gold/15 p-8 h-full flex flex-col gap-6 hover:border-gold/40 transition-colors bg-obsidian/40">
                <div className="font-display italic text-gold text-6xl leading-none">"</div>
                <blockquote className="font-display italic text-xl md:text-2xl leading-[1.4] text-ivory/90 text-balance">
                  {t.q}
                </blockquote>
                <figcaption className="mt-auto pt-6 border-t border-gold/15">
                  <div className="text-sm text-ivory font-semibold">{t.n}</div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-gold mt-1.5">
                    {t.r}
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
