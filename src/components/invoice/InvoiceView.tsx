// Wraps `InvoiceDocument` with the print chrome: a screen-only toolbar and
// the `@page` rule that makes the browser's own print-to-PDF produce a clean
// Letter-size, zero-margin PDF (design_handoff_krc_invoices — "use the
// browser print-to-PDF or a server renderer"; this repo has no headless
// renderer, so the browser is the PDF pipeline).

import { Printer } from "lucide-react";

import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import type { Invoice } from "@/lib/invoices";
import type { Result } from "@/lib/team";

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
    <div className="min-h-screen bg-[#e9e6df] py-10 print:bg-white print:py-0">
      <style>{`
        @media print {
          @page { size: letter; margin: 0; }
          body { background: #fff; }
        }
      `}</style>
      <div className="mx-auto mb-5 flex w-[8.5in] items-center justify-between print:hidden">
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
      <InvoiceDocument invoice={result.invoice} />
    </div>
  );
}
