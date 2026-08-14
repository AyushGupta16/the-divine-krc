ALTER TABLE "party_hall_enquiries" ADD COLUMN "quoted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "party_hall_enquiries" ADD COLUMN "advance_amount" integer;--> statement-breakpoint
ALTER TABLE "party_hall_enquiries" ADD COLUMN "advance_pct" integer;--> statement-breakpoint
ALTER TABLE "party_hall_enquiries" ADD COLUMN "refunded_at" timestamp with time zone;