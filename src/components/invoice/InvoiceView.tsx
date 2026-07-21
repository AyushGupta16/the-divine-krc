// Wraps `InvoiceDocument` with the print chrome: a screen-only toolbar and
// the `@page` rule that makes the browser's own print-to-PDF produce a clean
// Letter-size, zero-margin PDF (design_handoff_krc_invoices — "use the
// browser print-to-PDF or a server renderer"; this repo has no headless
// renderer, so the browser is the PDF pipeline).
//
// On screen the document keeps its true 8.5in layout and is scaled down
// uniformly (CSS transform) to fit narrow viewports, so mobile sees the same
// design just smaller — print/PDF output is untouched (transform is reset
// under @media print).

import { Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import type { Invoice } from "@/lib/invoices";
import type { Result } from "@/lib/team";

const DOC_WIDTH_PX = 816; // 8.5in at 96dpi, matches InvoiceDocument's w-[8.5in]

function ScaledInvoiceDocument({ invoice }: { invoice: Invoice }) {
  const docRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number>();

  useEffect(() => {
    const el = docRef.current;
    if (!el) return;

    const update = () => {
      const next = Math.min(1, window.innerWidth / DOC_WIDTH_PX);
      setScale(next);
      setScaledHeight(el.scrollHeight * next);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      className="mx-auto overflow-hidden print:h-auto! print:w-auto!"
      style={{ height: scaledHeight, width: DOC_WIDTH_PX * scale }}
    >
      <div
        ref={docRef}
        className="origin-top-left print:transform-none!"
        style={{ transform: `scale(${scale})`, width: DOC_WIDTH_PX }}
      >
        <InvoiceDocument invoice={invoice} />
      </div>
    </div>
  );
}

export function InvoiceView({
  result,
  invoiceNo,
}: {
  result: Result<{ invoice: Invoice }>;
  invoiceNo: string;
}) {
  if (!result.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e9e6df] px-6 text-center">
        <div>
          <p className="font-display text-2xl font-semibold text-obsidian">Invoice not found</p>
          <p className="mt-2 text-[13px] text-warm-gray">
            {result.error} ({invoiceNo})
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#e9e6df] py-6 sm:py-10 print:bg-white print:py-0">
      <style>{`
        @media print {
          @page { size: letter; margin: 0; }
          body { background: #fff; }
        }
      `}</style>
      <div className="mx-auto mb-5 flex w-full max-w-204 items-center justify-between px-4 print:hidden sm:px-0">
        <p className="text-[12px] text-warm-gray">Invoice {result.invoice.invoiceNo}</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-[5px] bg-obsidian px-4 py-2.5 text-[11px] font-bold tracking-[0.16em] text-gold uppercase transition-opacity hover:opacity-90"
        >
          <Printer className="size-3.5" />
          Download / Print
        </button>
      </div>
      <ScaledInvoiceDocument invoice={result.invoice} />
    </div>
  );
}
