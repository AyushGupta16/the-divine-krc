import { createFileRoute } from "@tanstack/react-router";

import { Nav } from "@/components/home/Nav";
import { Footer } from "@/components/home/Footer";
import { LegalPage } from "@/components/legal/LegalPage";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";

const PAGE_URL = `${SITE_URL}/privacy`;

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | The Divine KRC" },
      {
        name: "description",
        content: "How The Divine KRC collects, uses, and protects guest information.",
      },
      { property: "og:title", content: "Privacy Policy | The Divine KRC" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { property: "og:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <main className="bg-ivory text-obsidian font-sans antialiased selection:bg-gold/30 selection:text-obsidian">
      <Nav />
      <LegalPage title="Privacy Policy" updated="25 July 2026">
        {/*
          DRAFT — generic hotel privacy-policy content, not yet reviewed by
          the business owner or counsel. Placeholder pending review: replace
          or confirm before treating this as final. See issue #52.
        */}
        <p>
          This policy explains how The Divine KRC ("we", "us", "the hotel") collects, uses, and
          protects information about guests who book a stay, make an enquiry, or visit this website.
        </p>

        <h2>Information we collect</h2>
        <p>
          When you book a room, enquire about our party hall, or contact us, we collect the details
          you provide directly — typically your name, phone number, email address, and stay dates.
          If you pay online, our payment partner (Razorpay) processes your payment details directly;
          we do not store your card or UPI credentials ourselves.
        </p>

        <h2>How we use it</h2>
        <p>
          We use this information to confirm and manage your booking, communicate with you about
          your stay, and meet our own record-keeping and legal obligations as a hotel. We do not
          sell guest information to third parties.
        </p>

        <h2>Data retention</h2>
        <p>
          We retain booking and guest records for as long as needed to meet legal, accounting, and
          operational requirements.
        </p>

        <h2>Your rights</h2>
        <p>
          To ask about, correct, or request removal of your information, contact us using the
          details below.
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
