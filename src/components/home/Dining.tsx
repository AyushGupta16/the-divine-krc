import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import restaurantInterior from "@/assets/restaurant-interior.webp";
import restaurantDish from "@/assets/restaurant-dish-dalmakhani.webp";
import restaurantExterior from "@/assets/restaurant.jpg";
import { Reveal } from "./Reveal";

// Exterior → interior → food: establish the place, then the room, then the
// plate. The exterior shot is the same photo issue #53 flagged for being
// mislabeled as an interior — it's honest here, just relabeled.
const DINING_SHOTS = [
  {
    src: restaurantExterior,
    alt: "Exterior of The Divine KRC hotel and restaurant at dusk",
  },
  {
    src: restaurantInterior,
    alt: "Dining room at The Divine KRC restaurant, Pari Chowk, Greater Noida",
  },
  {
    src: restaurantDish,
    alt: "Dal makhani at The Divine KRC restaurant",
  },
];

const CARD_COUNT = DINING_SHOTS.length;
const SWIPE_THRESHOLD = 80;

// A drag-to-swipe stacked deck: the front card is draggable, the next two
// peek out behind it at a fixed offset, and swiping past the threshold (or
// the auto-advance timer, or the arrow buttons) cycles the front card to
// the back of the stack.
function DiningGallery() {
  const [front, setFront] = useState(0);
  const [dragX, setDragX] = useState(0);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const pausedRef = useRef(false);

  const advance = useCallback((dir: 1 | -1) => {
    setFront((f) => (f + dir + CARD_COUNT) % CARD_COUNT);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!pausedRef.current) advance(-1);
    }, 5000);
    return () => clearInterval(id);
  }, [advance]);

  function onPointerDown(e: React.PointerEvent<HTMLImageElement>) {
    draggingRef.current = true;
    pausedRef.current = true;
    startXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLImageElement>) {
    if (!draggingRef.current) return;
    setDragX(e.clientX - startXRef.current);
  }

  function onPointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    pausedRef.current = false;
    if (dragX > SWIPE_THRESHOLD) advance(-1);
    else if (dragX < -SWIPE_THRESHOLD) advance(1);
    setDragX(0);
  }

  return (
    <div className="relative w-full aspect-[5/4]">
      {DINING_SHOTS.map((shot, i) => {
        const pos = (i - front + CARD_COUNT) % CARD_COUNT;
        const isFront = pos === 0;
        const transform =
          pos === 0
            ? `translateX(${dragX}px) rotate(${dragX / 20}deg)`
            : pos === 1
              ? "translateY(14px) scale(0.94) rotate(1.5deg)"
              : "translateY(28px) scale(0.88) rotate(-1.5deg)";

        return (
          <img
            key={shot.src}
            src={shot.src}
            alt={shot.alt}
            width={1280}
            height={1280}
            loading={pos === 0 ? "eager" : "lazy"}
            draggable={false}
            onPointerDown={isFront ? onPointerDown : undefined}
            onPointerMove={isFront ? onPointerMove : undefined}
            onPointerUp={isFront ? onPointerUp : undefined}
            onPointerCancel={isFront ? onPointerUp : undefined}
            className={`absolute inset-0 size-full object-cover shadow-2xl transition-[transform,opacity] duration-500 ease-out touch-pan-y ${
              isFront ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
            }`}
            style={{
              transform,
              opacity: pos === 2 ? 0.45 : 1,
              zIndex: CARD_COUNT - pos,
              transitionDuration: isFront && draggingRef.current ? "0ms" : undefined,
            }}
          />
        );
      })}

      <div className="absolute bottom-4 right-4 z-40 flex gap-2">
        <button
          type="button"
          aria-label="Previous photo"
          onClick={() => advance(1)}
          className="flex items-center justify-center size-9 rounded-full bg-obsidian/60 backdrop-blur-sm border border-gold/30 text-gold hover:bg-obsidian/80 hover:border-gold transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Next photo"
          onClick={() => advance(-1)}
          className="flex items-center justify-center size-9 rounded-full bg-obsidian/60 backdrop-blur-sm border border-gold/30 text-gold hover:bg-obsidian/80 hover:border-gold transition-colors"
        >
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Dining() {
  return (
    <section id="dining" className="bg-obsidian text-ivory px-6 md:px-10 py-24 md:py-32">
      <div className="mx-auto max-w-7xl grid md:grid-cols-12 gap-12 md:gap-16 items-center">
        <Reveal className="md:col-span-7">
          <div className="relative">
            <DiningGallery />
            <div className="absolute -bottom-5 -left-5 z-50 hidden md:flex flex-col items-center justify-center size-28 bg-gold text-obsidian">
              <span className="font-display italic text-xs">Open</span>
              <span className="font-display text-2xl leading-none mt-1">7am</span>
              <span className="font-display italic text-[10px] mt-1">— 11pm</span>
            </div>
          </div>
        </Reveal>

        <div className="md:col-span-5 space-y-6">
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="h-px w-10 bg-gold" />
              <span className="text-gold text-[11px] uppercase tracking-[0.4em] font-semibold">
                The Restaurant
              </span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.05] text-balance">
              A table, <span className="italic text-gold">always set for you.</span>
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-ivory/70 text-base leading-relaxed">
              From regional Indian classics to global comfort, our in-house kitchen is led by a chef
              devoted to seasonal produce, attentive service, and unhurried meals. Breakfast on us
              when you book direct.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <ul className="space-y-3 pt-2">
              {[
                "Live breakfast bar · 7am – 10:30am",
                "All-day à la carte menu",
                "Private dining for up to 14",
              ].map((x) => (
                <li key={x} className="flex items-start gap-3 text-sm text-ivory/80">
                  <span className="text-gold mt-1.5 size-1 rounded-full bg-gold shrink-0" />
                  {x}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={320}>
            <a
              href="#book"
              className="inline-flex items-center gap-3 mt-4 border border-gold/50 hover:border-gold text-gold text-[11px] uppercase tracking-[0.25em] px-7 py-4 font-semibold hover:bg-gold/10 transition-colors"
            >
              Explore Menu <span>→</span>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
