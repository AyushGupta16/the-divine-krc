import { createFileRoute } from "@tanstack/react-router";

import { Nav } from "@/components/home/Nav";
import { Footer } from "@/components/home/Footer";
import { LegalPage } from "@/components/legal/LegalPage";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";

const PAGE_URL = `${SITE_URL}/terms`;

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions | The Divine KRC" },
      {
        name: "description",
        content: "Booking, payment, and stay terms for The Divine KRC.",
      },
      { property: "og:title", content: "Terms & Conditions | The Divine KRC" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { property: "og:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <main className="bg-ivory text-obsidian font-sans antialiased selection:bg-gold/30 selection:text-obsidian">
      <Nav />
      <LegalPage title="Terms & Conditions" updated="25 July 2026">
        {/*
          DRAFT — generic hotel terms content, not yet reviewed by the
          business owner or counsel. Cancellation/refund windows below are
          placeholders pending confirmation from the hotel — do not treat as
          final. See issue #52.
        */}
        <p>
          These terms govern bookings made directly with The Divine KRC, whether through this
          website, by phone, or in person.
        </p>

        <h2>Bookings</h2>
        <p>
          A booking is confirmed once payment (in full or as an advance, where accepted) is received
          or the hotel has otherwise confirmed the reservation in writing.
        </p>

        <h2>Payments</h2>
        <p>
          Online payments are processed securely via Razorpay. Pay-at-hotel bookings are settled at
          check-in or check-out as agreed at the time of booking.
        </p>

        <h2>Cancellations & refunds</h2>
        <p>
          <em>
            [Placeholder — pending confirmation from the hotel: cancellation window, refund
            percentage/eligibility, and no-show policy.]
          </em>
        </p>

        <h2>Guest conduct</h2>
        <p>
          Guests are expected to treat hotel staff, property, and other guests with respect. The
          hotel reserves the right to refuse or end a stay in cases of illegal activity, damage to
          property, or serious disruption to other guests.
        </p>

        <h2>Liability</h2>
        <p>
          The hotel is not liable for loss of personal belongings except where required by
          applicable law.
        </p>

        <h2>Contact</h2>
        <p>
          The Divine KRC, A 023, Kyampur, Sector Omicron I, Near Pari Chowk, Greater Noida, UP
          201310
          <br />
          <a href="mailto:thedivinekrc@gmail.com" className="text-gold hover:underline">
            thedivinekrc@gmail.com
          </a>{" "}
          ·{" "}
          <a href="tel:+918707368307" className="text-gold hover:underline">
            +91 87073 68307
          </a>
        </p>
      </LegalPage>
      <Footer />
    </main>
  );
}
