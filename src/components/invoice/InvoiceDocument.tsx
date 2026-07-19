// One template component drives all three invoice variants (design_handoff_krc_invoices).
// Header band, meta, fact strip, line table, totals, payment/notes and the
// running footer are shared; `type: "group"` swaps the single line table for
// a per-room section card, and `type: "party_hall"` swaps the totals footer
// for the advance/balance pair + terms.

import krcLogo from "@/assets/krc-logo.jpg";
import type { Invoice } from "@/lib/invoices";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const TYPE_LABEL: Record<Invoice["type"], string> = {
  room: "Room reservation",
  group: "Group reservation",
  party_hall: "Party hall booking",
};

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  return (
    <div className="mx-auto min-h-[11in] w-[8.5in] bg-white font-sans text-[#1c1a17] print:min-h-0 print:w-full print:shadow-none">
      {/* Top band */}
      <div className="flex items-start justify-between bg-obsidian px-12 py-8 text-ivory">
        <div className="flex items-center gap-3.5">
          <img src={krcLogo} alt="The Divine KRC crest" className="size-13 object-contain" />
          <div className="leading-tight">
            <div className="font-display text-[19px] font-semibold tracking-[0.04em]">
              The Divine KRC
            </div>
            <div className="mt-0.5 text-[10px] tracking-[0.28em] text-gold uppercase">
              Hotel &amp; Banquet
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-[30px] font-semibold tracking-[0.14em] text-gold-soft uppercase leading-none">
            Invoice
          </div>
          <div className="mt-1.5 text-[10px] tracking-[0.16em] text-gold uppercase">
            {TYPE_LABEL[invoice.type]}
          </div>
          <div className="mt-1 text-[11.5px] text-[#c9c3b6]">{invoice.invoiceNo}</div>
        </div>
      </div>
      <div className="h-[3px] bg-gold" />

      {/* Meta */}
      <div className="flex justify-between gap-8 px-12 pt-8">
        <div className="max-w-[280px]">
          <div className="mb-2 text-[9.5px] tracking-[0.2em] text-[#a49d8d] uppercase">
            Billed to
          </div>
          <div className="font-display text-[17px] font-semibold text-gold">
            {invoice.billedTo.name}
          </div>
          <div className="mt-1 text-[12.5px] leading-relaxed text-[#57524a]">
            {invoice.billedTo.phone}
            <br />
            {invoice.billedTo.email}
            <br />
            {invoice.billedTo.city}
          </div>
        </div>
        <div className="whitespace-nowrap text-right text-[12.5px] leading-loose text-[#57524a]">
          <div>
            <span className="tracking-[0.06em] text-[#a49d8d]">Invoice date</span>{" "}
            <b className="text-[#1c1a17]">{fmtDate(invoice.issuedAt)}</b>
          </div>
          <div>
            <span className="tracking-[0.06em] text-[#a49d8d]">
              {invoice.type === "group" ? "Group ID" : "Booking ID"}
            </span>{" "}
            <b className="text-[#1c1a17]">{invoice.refId}</b>
          </div>
          {invoice.checkIn && (
            <div>
              <span className="tracking-[0.06em] text-[#a49d8d]">Check-in</span>{" "}
              <b className="text-[#1c1a17]">{fmtDate(invoice.checkIn)}</b>
            </div>
          )}
          {invoice.checkOut && (
            <div>
              <span className="tracking-[0.06em] text-[#a49d8d]">Check-out</span>{" "}
              <b className="text-[#1c1a17]">{fmtDate(invoice.checkOut)}</b>
            </div>
          )}
        </div>
      </div>

      {/* Fact strip */}
      <div className="mt-6.5 flex rounded-lg border border-[#efe4cc] bg-[#faf7ef] px-0 mx-12">
        {invoice.facts.map((f) => (
          <div
            key={f.label}
            className="flex-1 border-r border-[#efe4cc] px-4.5 py-3.75 last:border-r-0"
          >
            <div className="text-[9.5px] tracking-[0.16em] text-[#a49d8d] uppercase">{f.label}</div>
            <div className="mt-1 font-display text-[17px] font-semibold">{f.value}</div>
          </div>
        ))}
      </div>

      {invoice.type === "group" ? (
        <div className="px-12 pt-6.5">
          {invoice.sections.map((s) => (
            <div
              key={s.refId}
              className="mb-5 overflow-hidden rounded-lg border border-[#eee7d9]"
              style={{ breakInside: "avoid" }}
            >
              <div className="flex items-center justify-between border-b border-[#eee7d9] bg-[#f4efe4] px-4 py-2.75">
                <div className="font-display text-[14.5px] font-semibold">{s.title}</div>
                <div className="text-[10.5px] tracking-[0.06em] text-[#8a8375]">
                  Booking <b className="text-[#57524a]">{s.refId}</b> &middot; {s.meta}
                </div>
              </div>
              <LineTable lines={s.lines} />
              <div className="flex justify-end gap-4 bg-[#fcfaf5] px-4 py-2.25">
                <span className="self-center text-[11px] tracking-[0.1em] text-[#a49d8d] uppercase">
                  Room subtotal
                </span>
                <span className="font-display text-[15px] font-semibold">
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(s.subtotal)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-12 pt-7.5">
          <div className="grid grid-cols-[1fr_74px_96px_110px] rounded-t-md bg-obsidian text-[10px] font-bold tracking-[0.12em] text-gold-soft uppercase">
            <div className="px-4 py-3">Description</div>
            <div className="px-2 py-3 text-center">Qty</div>
            <div className="px-3 py-3 text-right">Rate</div>
            <div className="px-4 py-3 text-right">Amount</div>
          </div>
          <LineTable lines={invoice.sections[0]?.lines ?? []} />
        </div>
      )}

      {/* Totals */}
      <div className="flex justify-end px-12 pt-5">
        <div className="w-[300px]">
          {invoice.totalRows.map((t) => (
            <div
              key={t.label}
              className="flex justify-between py-1.75 text-[12.5px]"
              style={{ color: t.negative ? "#b4553f" : "#57524a" }}
            >
              <span>{t.label}</span>
              <span className="font-semibold">{t.value}</span>
            </div>
          ))}
          <div className="mt-2.5 flex items-center justify-between rounded-lg bg-obsidian px-4.5 py-3.5 text-ivory">
            <span className="text-[11px] tracking-[0.18em] text-gold-soft uppercase">
              {invoice.type === "party_hall" ? "Grand total" : "Total paid"}
            </span>
            <span className="font-display text-[24px] font-semibold">
              {formatINR(invoice.grandTotal)}
            </span>
          </div>
          {invoice.type !== "party_hall" && (
            <div className="flex justify-between px-0.5 pt-2.25 text-[12px] text-[#57524a]">
              <span>Balance due</span>
              <span
                className="font-bold"
                style={{ color: invoice.balanceDue > 0 ? "#b4553f" : "#5a8a5a" }}
              >
                {formatINR(invoice.balanceDue)}
              </span>
            </div>
          )}
        </div>
      </div>

      {invoice.type === "party_hall" && (
        <div className="flex gap-3.5 px-12 pt-5.5">
          <div className="flex-1 rounded-lg border border-[#cfe0cf] bg-[#e6efe6] px-4.5 py-3.5">
            <div className="text-[9.5px] tracking-[0.16em] text-[#7a9a7a] uppercase">
              Advance paid (25%)
            </div>
            <div className="mt-1 font-display text-[22px] font-semibold text-[#3f6b3f]">
              {formatINR(invoice.advance ?? 0)}
            </div>
          </div>
          <div className="flex-1 rounded-lg border border-[#ecdcbd] bg-[#f7efe0] px-4.5 py-3.5">
            <div className="text-[9.5px] tracking-[0.16em] text-[#a8863f] uppercase">
              Balance due
            </div>
            <div className="mt-1 font-display text-[22px] font-semibold text-[#a8863f]">
              {formatINR(invoice.balanceDue)}
            </div>
            {invoice.eventDate && (
              <div className="mt-0.5 text-[11px] text-[#9a8350]">
                Payable by {fmtDate(invoice.eventDate)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment + notes */}
      <div className="flex gap-6 px-12 pt-6.5">
        <div className="flex-1 rounded-lg border border-[#efe4cc] bg-[#faf7ef] px-4.5 py-4">
          <div className="mb-2.25 text-[9.5px] tracking-[0.18em] text-[#a49d8d] uppercase">
            Payment
          </div>
          <Row label="Method" value={invoice.payment.method} />
          <Row label="Reference" value={invoice.payment.reference} />
          <Row label="Status" value={invoice.payment.status} valueClassName="text-[#5a8a5a]" />
        </div>
        <div className="flex-1 text-[11.5px] leading-relaxed text-[#7a746a]">
          <div className="mb-2.25 text-[9.5px] tracking-[0.18em] text-[#a49d8d] uppercase">
            {invoice.type === "party_hall" ? "Terms" : "Notes"}
          </div>
          {invoice.type === "party_hall"
            ? "25% advance confirms the booking and is non-refundable within 15 days of the event. Final guest count locks 72 hours prior. Balance payable on the event day. GST included where applicable."
            : invoice.type === "group"
              ? `One receipt covers all ${invoice.sections.length} rooms in this group reservation; each room retains its own booking ID for check-in. GST applied on the group taxable value. Computer-generated receipt — no signature required.`
              : "Prices are inclusive of GST where applicable. This is a computer-generated receipt and does not require a signature. For assistance, contact the front desk."}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6.5 flex items-center justify-between border-t border-[#eae4d6] px-12 py-3.5 text-[10.5px] text-[#a49d8d]">
        <span className="tracking-[0.04em]">
          The Divine KRC · thedivinekrc.in · +91 87073 68307
        </span>
        <span className="tracking-[0.16em] text-gold uppercase">
          {invoice.type === "party_hall"
            ? "We look forward to hosting you"
            : "Thank you for your stay"}
        </span>
      </div>
    </div>
  );
}

function LineTable({ lines }: { lines: Invoice["sections"][number]["lines"] }) {
  return (
    <>
      {lines.map((it, i) => (
        <div
          key={`${it.name}-${i}`}
          className="grid grid-cols-[1fr_74px_96px_110px] items-center border-b border-[#eee7d9] text-[12.5px] last:border-b-0"
        >
          <div className="px-4 py-3">
            <div className="font-semibold text-[#1c1a17]">{it.name}</div>
            {it.note && <div className="mt-0.5 text-[11px] text-[#a49d8d]">{it.note}</div>}
          </div>
          <div className="px-2 py-3 text-center text-[#57524a]">{it.qty}</div>
          <div className="px-3 py-3 text-right text-[#57524a]">{it.rate}</div>
          <div className="px-4 py-3 text-right font-semibold">{it.amount}</div>
        </div>
      ))}
    </>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between py-0.75 text-[12.5px] text-[#57524a]">
      <span>{label}</span>
      <b className={valueClassName ?? "text-[#1c1a17]"}>{value}</b>
    </div>
  );
}

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
