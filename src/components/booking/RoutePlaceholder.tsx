// Temporary scaffold placeholder for booking-system routes (PR #0).
// Each feature PR replaces the route body with its real screen.

export function RoutePlaceholder({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-ivory px-6 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-gold">The Divine KRC</p>
      <h1 className="font-display text-3xl text-obsidian">{title}</h1>
      {typeof count === "number" && (
        <p className="text-sm text-warm-gray">{count} record(s) loaded</p>
      )}
      <p className="mt-2 text-xs text-warm-gray/70">
        Scaffold placeholder — implemented in a later PR.
      </p>
    </div>
  );
}
