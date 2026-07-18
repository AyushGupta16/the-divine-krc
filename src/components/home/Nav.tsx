import { useEffect, useState } from "react";
import { FileSearch } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import logo from "@/assets/krc-logo.jpg";

const links = ["Rooms", "Events", "Dining", "Amenities", "Gallery", "Contact"];

/**
 * `alwaysSolid` skips the transparent-over-hero gradient for pages with no
 * hero image behind the nav (the booking flow's ivory background would
 * otherwise show through the gradient as a near-white bar until the guest
 * scrolls past 24px).
 */
export function Nav({ alwaysSolid = false }: { alwaysSolid?: boolean } = {}) {
  const [scrolled, setScrolled] = useState(alwaysSolid);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (alwaysSolid) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [alwaysSolid]);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-obsidian/95 backdrop-blur-md border-b border-gold/15"
          : "bg-gradient-to-b from-obsidian/70 to-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-5 md:px-10 py-3 md:py-4 flex items-center justify-between">
        <a href="/#top" className="flex items-center gap-3 group">
          <img
            src={logo}
            alt="The Divine KRC crest"
            width={40}
            height={40}
            className="size-9 md:size-10 object-contain"
          />
          <span className="hidden sm:flex flex-col leading-none">
            <span className="font-display italic text-gold-soft text-[11px] tracking-[0.25em] uppercase whitespace-pre-line">
              THE{"\n"}DIVINE{"\n"}KRC
            </span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l}
              href={`/#${l.toLowerCase()}`}
              className="relative text-ivory/80 hover:text-gold text-[12px] uppercase tracking-[0.22em] transition-colors after:absolute after:left-0 after:-bottom-1 after:h-px after:w-0 hover:after:w-full after:bg-gold after:transition-all after:duration-500"
            >
              {l}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="/booking-lookup"
                  aria-label="Manage booking"
                  className="hidden md:inline-flex size-9 items-center justify-center rounded-full border border-gold/30 text-ivory/70 hover:border-gold hover:text-gold transition-colors"
                >
                  <FileSearch className="size-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="rounded-[4px] border border-gold/20 bg-obsidian px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-gold"
              >
                Manage Booking
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <a
            href="/book"
            className="hidden md:inline-flex items-center text-[11px] uppercase tracking-[0.22em] text-obsidian bg-gold hover:bg-gold-soft transition-colors px-5 py-2.5 font-semibold"
          >
            Book Direct
          </a>
          <button
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden text-gold border border-gold/30 rounded-full px-4 py-1.5 text-[10px] uppercase tracking-[0.22em] font-semibold"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-500 bg-obsidian border-t border-gold/10 ${
          open ? "max-h-[28rem]" : "max-h-0"
        }`}
      >
        <div className="px-6 py-6 flex flex-col gap-4">
          {links.map((l) => (
            <a
              key={l}
              href={`/#${l.toLowerCase()}`}
              onClick={() => setOpen(false)}
              className="text-ivory/80 text-sm uppercase tracking-[0.22em]"
            >
              {l}
            </a>
          ))}
          <a
            href="/book"
            onClick={() => setOpen(false)}
            className="mt-2 inline-flex justify-center bg-gold text-obsidian text-[11px] uppercase tracking-[0.22em] py-3 font-semibold"
          >
            Book Direct
          </a>
          <a
            href="/booking-lookup"
            onClick={() => setOpen(false)}
            className="inline-flex justify-center border border-gold/30 text-gold text-[11px] uppercase tracking-[0.22em] py-3 font-semibold"
          >
            Manage Booking
          </a>
        </div>
      </div>
    </nav>
  );
}
