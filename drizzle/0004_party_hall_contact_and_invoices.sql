CREATE TABLE "invoices" (
	"invoice_no" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"ref_id" text NOT NULL,
	"booking_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"issued_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "party_hall_enquiries" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "party_hall_enquiries" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "party_hall_enquiries" ADD COLUMN "contact_email" text;