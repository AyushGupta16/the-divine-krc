import { useEffect, useState } from "react";

/**
 * The floating scroll controls for the landing page — fixed in the corner
 * for the whole page, not just the hero. Two independent chips stacked in
 * the same corner rather than one dial that flips between them: a "TOP" chip
 * (hidden right at the very top, since there's nothing above to jump to) and
 * a "SCROLL" chip (hidden right at the very bottom, since there's nothing
 * below). In the middle of a long page both are visible at once, stacked,
 * so a guest can jump either direction without scrolling all the way first.
 */
export function ScrollDial() {
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const full = document.documentElement.scrollHeight;
      setAtTop(window.scrollY < 24);
      setAtBottom(scrolled >= full - 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  function scrollToTop() {
    document.getElementById("top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Scroll to the true bottom, not just the top of #contact: the footer
  // itself runs taller than one screen on mobile, so landing on its top edge
  // left most of it — and the "atBottom" flip — below the fold.
  function scrollToBottom() {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }

  return (
    <div className="fixed bottom-6 right-5 md:bottom-8 md:right-8 z-40 flex flex-col items-center gap-3">
      <DialChip
        label="TOP"
        reversed
        visible={!atTop}
        onClick={scrollToTop}
        ariaLabel="Back to top"
      />
      <DialChip
        label="SCROLL"
        visible={!atBottom}
        onClick={scrollToBottom}
        ariaLabel="Scroll to footer"
      />
    </div>
  );
}

function DialChip({
  label,
  onClick,
  ariaLabel,
  reversed = false,
  visible,
}: {
  label: string;
  onClick: () => void;
  ariaLabel: string;
  reversed?: boolean;
  visible: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      // Always mounted, never removed from the DOM on toggle — a mount/
      // unmount swap can't be animated. Appearing waits a beat (delay-300)
      // so a guest hovering right at the top/bottom threshold doesn't see
      // the chip flicker in and out; disappearing starts fading immediately.
      className={`animate-float flex items-center gap-2.5 rounded-full bg-obsidian/40 px-3 py-3.5 text-ivory/70 backdrop-blur-sm transition-[opacity,color] duration-500 ease-out hover:text-gold ${
        reversed ? "flex-col-reverse" : "flex-col"
      } ${visible ? "opacity-100 delay-300" : "pointer-events-none opacity-0"}`}
    >
      <span className="h-10 w-px bg-gold/40 motion-safe:animate-pulse" />
      <span
        className="text-[9px] uppercase tracking-[0.3em] [writing-mode:vertical-rl] rotate-180"
        aria-hidden="true"
      >
        {label}
      </span>
    </button>
  );
}
