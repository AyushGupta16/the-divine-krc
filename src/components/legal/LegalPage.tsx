import type { ReactNode } from "react";

/**
 * Shared shell for /privacy and /terms. Both currently render draft content
 * pending legal review (see issue #52) — the banner is load-bearing, not
 * decorative, until that review happens.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <section className="px-6 md:px-10 pt-32 pb-24 md:pb-32">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl md:text-5xl text-obsidian mb-3">{title}</h1>
        <p className="text-warm-gray text-sm mb-8">Last updated {updated}</p>

        <div className="mb-10 border border-gold/30 bg-gold/5 px-5 py-4 text-sm text-warm-gray leading-relaxed">
          This page is a draft pending review by the hotel and its legal counsel — content may
          change before it's treated as final.
        </div>

        <div className="space-y-6 text-sm md:text-base leading-relaxed text-obsidian/85 [&_h2]:font-display [&_h2]:text-xl [&_h2]:md:text-2xl [&_h2]:text-obsidian [&_h2]:mt-10 [&_h2]:mb-3">
          {children}
        </div>
      </div>
    </section>
  );
}
