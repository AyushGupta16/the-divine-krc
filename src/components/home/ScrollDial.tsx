import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

/**
 * The one floating scroll control for the landing page — fixed in the corner
 * for the whole page, not just the hero, so it's still there once the guest
 * has scrolled past it. It's a single dial with two faces, not two buttons:
 * pointing down (scroll to the footer) everywhere above the footer, and
 * pointing up (scroll to top) once the footer is in view — never both at
 * once, so there's no dead button sitting unused at either end.
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

  return (
    <button
      type="button"
      aria-label={atBottom ? "Back to top" : "Scroll to footer"}
      onClick={go}
      className="fixed bottom-6 right-5 md:bottom-8 md:right-8 z-40 flex size-11 items-center justify-center rounded-full bg-gold text-obsidian shadow-lg transition-colors hover:bg-gold-soft"
    >
      {atBottom ? <ArrowUp className="size-4.5" /> : <ArrowDown className="size-4.5" />}
    </button>
  );
}
