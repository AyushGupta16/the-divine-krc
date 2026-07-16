import type { ReactNode } from "react";
import krcLogo from "@/assets/krc-logo.jpg";

interface AuthLayoutProps {
  /** Small uppercase label above the headline, e.g. "Admin console". */
  eyebrow: string;
  /** Headline first line. */
  title: ReactNode;
  /** Emphasised italic second line. */
  titleAccent: ReactNode;
  /** Supporting paragraph under the headline. */
  description: ReactNode;
  /** Optional stats row / footer note inside the brand panel. */
  panelFooter?: ReactNode;
  /** The form card content. */
  children: ReactNode;
}

/**
 * Split-panel auth chrome: obsidian brand panel (left) + form area (right),
 * stacking to a single column below 768px. Shared by login, forgot- and
 * reset-password screens.
 */
export function AuthLayout({
  eyebrow,
  title,
  titleAccent,
  description,
  panelFooter,
  children,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-ivory font-sans text-obsidian md:flex-row">
      {/* Brand panel */}
      <div className="relative flex flex-col overflow-hidden bg-obsidian px-7 py-8 text-ivory md:w-130 md:flex-none md:px-13 md:py-12">
        <div className="flex items-center gap-3">
          <img src={krcLogo} alt="The Divine KRC crest" className="h-11 w-11 object-contain" />
          <span className="whitespace-pre-line font-display text-[12px] italic uppercase leading-tight tracking-[0.25em] text-gold-soft">
            {"THE\nDIVINE\nKRC"}
          </span>
        </div>

        <div className="mt-10 md:mt-auto">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px w-8 bg-gold" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-gold">
              {eyebrow}
            </span>
          </div>
          <h1 className="mb-4 font-display text-[30px] font-semibold leading-[1.15] md:text-[38px]">
            {title}
            <br />
            <span className="italic text-gold-soft">{titleAccent}</span>
          </h1>
          <p className="m-0 max-w-90 text-[13.5px] leading-[1.7] text-[#c9c3b6]">{description}</p>
        </div>

        {panelFooter && <div className="mt-10 border-t border-gold/20 pt-6">{panelFooter}</div>}
      </div>

      {/* Form area */}
      <div className="flex flex-1 items-center justify-center p-8 md:p-10">
        <div className="w-full max-w-88">{children}</div>
      </div>
    </div>
  );
}
