import { useEffect, useState } from "react";

/**
 * The one floating scroll control for the landing page — fixed in the corner
 * for the whole page, not just the hero, so it's still there once the guest
 * has scrolled past it. Matches the hero's original vertical-line-and-label
 * mark, just made clickable and given a second, mirrored face: label-over-
 * line pointing down (scroll to the footer) everywhere above the footer,
 * flipping to line-over-label pointing up (scroll to top) once the footer is
 * in view — never both at once, so there's no dead mark at either end. The
 * dark chip behind it is new: the original only ever sat on the hero's own
 * dark image, but this one has to stay legible over the ivory sections too.
 */
export function ScrollDial() {
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const full = document.documentElement.scrollHeight;
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

  function go() {
    document
      .getElementById(atBottom ? "top" : "contact")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const label = atBottom ? "TOP" : "SCROLL";

  return (
    <button
      type="button"
      aria-label={atBottom ? "Back to top" : "Scroll to footer"}
      onClick={go}
      className={`fixed bottom-6 right-5 md:bottom-8 md:right-8 z-40 flex items-center gap-2.5 rounded-full bg-obsidian/40 px-3 py-3.5 text-ivory/70 backdrop-blur-sm transition-colors hover:text-gold ${
        atBottom ? "flex-col-reverse" : "flex-col"
      }`}
    >
      <span className="h-10 w-px bg-gold/40 motion-safe:animate-pulse" />
      <span
        className="flex flex-col items-center text-[9px] uppercase leading-[1.6] tracking-widest"
        aria-hidden="true"
      >
        {label.split("").map((ch, i) => (
          <span key={i}>{ch}</span>
        ))}
      </span>
    </button>
  );
}
