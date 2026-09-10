# The Divine KRC

**A full-stack hotel booking & property management platform, built for a real 14-room boutique hotel in Greater Noida.**

🔗 Live: [thedivinekrc.in](https://www.thedivinekrc.in)

---

## Why this exists

Independent hotels lose 15–25% of every booking to OTA commissions (Booking.com, MakeMyTrip, Goibibo). The Divine KRC needed a direct-booking channel with real SEO weight behind it — not just a brochure site, but a system the owner could actually run the property on.

This repo is both:
1. **A public marketing + direct-booking site** — SEO-optimized landing pages, guest-facing booking flow, Razorpay payments.
2. **A full admin PMS (property management system)** — built from scratch for daily hotel operations: room assignment, billing, GST compliance, party-hall event management, and role-based staff access.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TanStack Start/Router, TypeScript, Tailwind v4, shadcn/ui |
| Backend | Netlify Functions (Node Lambda) |
| Database | Neon Postgres + Drizzle ORM (separate prod/dev branches) |
| Auth | Google OAuth (arctic) + custom app-layer RBAC — no third-party auth platform |
| Payments | Razorpay |
| Deployment | Netlify, CI-gated migrations on main-push |

## What's actually in it

- **Direct booking engine** — availability, room assignment, meal plans, special requests, and priced add-ons with a full apply/decline/reverse state machine.
- **GST-compliant billing pipeline** — room stays taxed at 5% (no ITC), party-hall bookings at 18%, with historical rate tracking so paid invoices freeze their rate at time of payment while unpaid ones recompute live.
- **Party-hall event pipeline** — enquiry → quote → advance → confirm → complete, with rate-snapshotted quoting so past quotes don't drift when prices change.
- **Role-based access control** — server-guarded on every sensitive endpoint, role-aware sidebar, multi-session account switching.
- **Admin notification center** — derive-on-read event feed for new bookings and party-hall activity.
- **SEO infrastructure** — landmark-targeted landing pages (nearby universities, Jewar Airport, Buddh International Circuit), AggregateRating structured data, dynamic sitemap.
- **CSV export** across every admin data view.
- **Google OAuth** login with HMAC-secured handoff between Netlify Functions and the client.

## Scale

- 369 commits, built solo end-to-end (frontend, backend, schema, infra, SEO)
- Live production system currently used to run a real hotel's daily bookings
- 97.9% TypeScript

## Screenshots

*(add 2–3 screenshots here: the booking flow, the admin dashboard, and the party-hall pipeline — these sell the project faster than any bullet point)*

---

Built by [Ayush Gupta](https://linkedin.com/in/ayushgupta1606)
