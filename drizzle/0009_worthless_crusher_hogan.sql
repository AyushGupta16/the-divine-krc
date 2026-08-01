CREATE TABLE "addon_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "requested_services" jsonb;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "revenue_other_note" text;