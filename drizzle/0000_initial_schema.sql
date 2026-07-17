CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"guest_id" text NOT NULL,
	"room_no" text,
	"room_type" text NOT NULL,
	"check_in" text NOT NULL,
	"check_out" text NOT NULL,
	"urn" integer NOT NULL,
	"source" text NOT NULL,
	"meal_plan" text NOT NULL,
	"revenue_room" integer DEFAULT 0 NOT NULL,
	"revenue_early_check_in" integer DEFAULT 0 NOT NULL,
	"revenue_late_check_out" integer DEFAULT 0 NOT NULL,
	"revenue_other" integer DEFAULT 0 NOT NULL,
	"revenue_discount" integer DEFAULT 0 NOT NULL,
	"revenue_tax_pct" integer NOT NULL,
	"collection_paid_to_hotel" integer DEFAULT 0 NOT NULL,
	"collection_ota_collection" integer DEFAULT 0 NOT NULL,
	"collection_ota_commission" integer DEFAULT 0 NOT NULL,
	"collection_complimentary" integer DEFAULT 0 NOT NULL,
	"collection_pending" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"city" text NOT NULL,
	"stays" integer DEFAULT 0 NOT NULL,
	"lifetime_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "party_hall_enquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"slot" text NOT NULL,
	"guests" integer NOT NULL,
	"package" text NOT NULL,
	"add_ons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE no action ON UPDATE no action;