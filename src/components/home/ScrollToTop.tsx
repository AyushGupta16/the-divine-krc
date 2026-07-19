import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/** Floating "back to top" button — appears once the guest has scrolled past
 *  the hero, and smooth-scrolls to `#top` on click (no page-share reload,
 *  since the section id already matches the nav's own anchor targets). */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-6 right-5 md:bottom-8 md:right-8 z-40 flex size-11 items-center justify-center rounded-full bg-gold text-obsidian shadow-lg transition-all duration-300 hover:bg-gold-soft ${
        visible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-3"
      }`}
    >
      <ArrowUp className="size-4.5" />
    </button>
  );
}
