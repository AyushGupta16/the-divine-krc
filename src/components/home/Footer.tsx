import { Link } from "@tanstack/react-router";
import logo from "@/assets/krc-logo.jpg";

export function Footer() {
  return (
    <footer className="bg-obsidian text-ivory/70 px-6 md:px-10 pt-20 pb-10 border-t border-gold/15">
      <div className="mx-auto max-w-7xl">
        <div className="grid md:grid-cols-12 gap-12 mb-16">
          <div className="md:col-span-4 space-y-5">
            <img
              src={logo}
              alt="The Divine KRC"
              width={64}
              height={64}
              className="size-14 object-contain"
            />
            <div>
              <div className="font-display italic text-gold-soft text-sm tracking-[0.25em] uppercase whitespace-pre-line leading-tight">
                THE{"\n"}DIVINE{"\n"}KRC
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-ivory/40 mt-1">
                Hotels & Restaurant
              </div>
            </div>
            <p className="text-sm leading-relaxed max-w-xs text-ivory/60">
              An urban boutique sanctuary moments from Pari Chowk, Greater Noida.
            </p>
          </div>

          <div className="md:col-span-3 space-y-4">
            <div className="text-gold text-[10px] uppercase tracking-[0.3em] font-semibold">
              Visit
            </div>
            <p className="text-sm leading-relaxed text-ivory/70">
              A 023, Kyampur,
              <br />
              {/* Sector Omicron I<br /> */}
              Sector Omicron I, Near Pari Chowk,
              <br />
              Greater Noida, UP 201310
            </p>
          </div>

          <div className="md:col-span-3 space-y-4">
            <div className="text-gold text-[10px] uppercase tracking-[0.3em] font-semibold">
              Reservations
            </div>
            <ul className="text-sm space-y-2 text-ivory/70">
              <li>
                <a href="tel:+918707368307" className="hover:text-gold transition-colors">
                  +91 87073 68307
                </a>
              </li>
              <li>
                <a href="tel:+918299162396" className="hover:text-gold transition-colors">
                  +91 82991 62396
                </a>
              </li>
              <li>
                <a
                  href="mailto:thedivinekrc@gmail.com"
                  className="hover:text-gold transition-colors"
                >
                  thedivinekrc@gmail.com
                </a>
              </li>
              <li>
                <span className="text-[10px] uppercase tracking-[0.25em] text-ivory/40">
                  Open 24 / 7
                </span>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="text-gold text-[10px] uppercase tracking-[0.3em] font-semibold">
              Follow
            </div>
            <ul className="text-sm space-y-2 text-ivory/70">
              <li>
                <a
                  href="https://www.instagram.com/krc_hotels_and_restaurant/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/people/The-Divine-Krc-Hotels-And-Restaurant-Omicron-1-greater-noida/61568703404213/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href="https://www.zomato.com/ncr/the-divine-krc-restaurant-xu-3-greater-noida/photos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  Zomato
                </a>
              </li>
              <li>
                <a
                  href="https://www.swiggy.com/city/noida-1/the-divine-krc-restaurant-greater-noida-rest1249598"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  Swiggy
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gold/10 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-[0.25em] text-ivory/40">
          <span>© 2026 The Divine KRC · All rights reserved</span>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link to="/privacy" className="hover:text-gold transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-gold transition-colors">
              Terms
            </Link>
            <a href="#" className="hover:text-gold transition-colors">
              Best Rate Guarantee
            </a>
            <Link to="/booking-lookup" className="hover:text-gold transition-colors">
              Manage Booking
            </Link>
            <Link to="/admin/login" rel="nofollow" className="hover:text-gold transition-colors">
              Staff Login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
