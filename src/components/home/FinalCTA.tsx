import { Reveal } from "./Reveal";

export function FinalCTA() {
  return (
    <section className="bg-gold px-6 md:px-10 py-24 md:py-32 text-center relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_center,_#0a0a0a_1px,_transparent_1px)] bg-[length:24px_24px]" />
      <Reveal className="relative">
        <div className="mx-auto max-w-2xl space-y-7">
          <span className="text-obsidian/70 text-[11px] uppercase tracking-[0.4em] font-semibold">
            Book Direct · Best Rates
          </span>
          <h2 className="font-display text-4xl md:text-6xl text-obsidian italic leading-[1.05] text-balance">
            Ready for an unforgettable stay?
          </h2>
          <p className="text-obsidian/75 text-base md:text-lg max-w-xl mx-auto">
            Reserve directly with us for guaranteed best rates, complimentary breakfast, and a
            personal welcome at arrival.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href="#book"
              className="inline-flex items-center bg-obsidian text-gold text-[11px] uppercase tracking-[0.25em] px-9 py-5 font-semibold hover:bg-obsidian/90 transition-colors"
            >
              Reserve Your Stay
            </a>
            <p>or</p>
            <a
              href="https://wa.me/918707368307?text=Hi%2C%20I%27d%20like%20to%20enquire%20about%20a%20stay%20at%20The%20Divine%20KRC."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-obsidian text-[11px] uppercase tracking-[0.25em] px-9 py-5 font-semibold hover:bg-[#25D366]/90 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.87 9.87 0 0 0 12.04 2Zm0 18.1h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 5.83 2.42 8.18 8.18 0 0 1 2.41 5.82c0 4.55-3.7 8.25-8.25 8.25Zm4.52-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.4-.12-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.36-.77-1.86-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.24 3.74.59.26 1.06.41 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.23-.17-.48-.29Z" />
              </svg>
              WhatsApp Us
            </a>
            <a
              href="tel:+918707368307"
              className="inline-flex items-center text-obsidian text-[11px] uppercase tracking-[0.25em] border-b border-obsidian/40 hover:border-obsidian pb-1 transition-colors"
            >
              Or call +91 87073 68307
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
