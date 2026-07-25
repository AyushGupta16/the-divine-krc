import { Reveal } from "./Reveal";

// Verbatim quotes from real, verified Google Business Profile reviews —
// reviewer names and text unedited. No location/role is shown unless the
// reviewer's own Google review carried that label.
const quotes = [
  {
    q: "Divine KRC Hotel exceeded my expectations! The staff were warm and welcoming, the rooms were clean and cozy, and the food was delicious. The hotel's ambiance was perfect for a relaxing stay. I appreciated the convenient location and excellent service. Highly recommend for a comfortable and enjoyable experience!",
    n: "Harshit Agrahari",
    r: "Verified Google review",
  },
  {
    q: "Food and services were good. I was quite happy with my 4 night stay there. I'd recommend this to anyone.",
    n: "Rohit Imandi",
    r: "Verified Google review",
  },
  {
    q: "The best place to stay here. The manager and all staff are very humble.",
    n: "PRINCE VERMA",
    r: "Verified Google review",
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
