import logo from "@/assets/krc-logo.jpg";

export function Footer() {
  return (
    <footer className="bg-obsidian text-ivory/70 px-6 md:px-10 pt-20 pb-10 border-t border-gold/15">
      <div className="mx-auto max-w-7xl">
        <div className="grid md:grid-cols-12 gap-12 mb-16">
          <div className="md:col-span-4 space-y-5">
            <img src={logo} alt="The Divine KRC" width={64} height={64} className="size-14 object-contain" />
            <div>
              <div className="font-display italic text-gold-soft text-sm tracking-[0.25em] uppercase whitespace-pre-line leading-tight">
                THE{"\n"}DIVINE{"\n"}KRC
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-ivory/40 mt-1">Hotels & Restaurant</div>
            </div>
            <p className="text-sm leading-relaxed max-w-xs text-ivory/60">
              An urban boutique sanctuary moments from Pari Chowk, Greater Noida.
            </p>
          </div>

          <div className="md:col-span-3 space-y-4">
            <div className="text-gold text-[10px] uppercase tracking-[0.3em] font-semibold">Visit</div>
            <p className="text-sm leading-relaxed text-ivory/70">
              A 023, Kyampur,<br />
              {/* Sector Omicron I<br /> */}
              Sector Omicron I, Near Pari Chowk,<br />
              Greater Noida, UP 201310
            </p>
          </div>

          <div className="md:col-span-3 space-y-4">
            <div className="text-gold text-[10px] uppercase tracking-[0.3em] font-semibold">Reservations</div>
            <ul className="text-sm space-y-2 text-ivory/70">
              <li><a href="tel:+918707368307" className="hover:text-gold transition-colors">+91 87073 68307</a></li>
              <li><a href="tel:+918299162396" className="hover:text-gold transition-colors">+91 82991 62396</a></li>
              <li><a href="mailto:thedivinekrc@gmail.com" className="hover:text-gold transition-colors">thedivinekrc@gmail.com</a></li>
              <li><span className="text-[10px] uppercase tracking-[0.25em] text-ivory/40">Open 24 / 7</span></li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="text-gold text-[10px] uppercase tracking-[0.3em] font-semibold">Follow</div>
            <ul className="text-sm space-y-2 text-ivory/70">
              <li><a href="#" className="hover:text-gold transition-colors">Instagram</a></li>
              <li><a href="#" className="hover:text-gold transition-colors">Facebook</a></li>
              <li><a href="#" className="hover:text-gold transition-colors">LinkedIn</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gold/10 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-[0.25em] text-ivory/40">
          <span>© 2026 The Divine KRC · All rights reserved</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gold transition-colors">Privacy</a>
            <a href="#" className="hover:text-gold transition-colors">Terms</a>
            <a href="#" className="hover:text-gold transition-colors">Best Rate Guarantee</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
