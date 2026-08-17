ALTER TABLE "bookings" ALTER COLUMN "check_in_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "check_out_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "party_hall_enquiries" ALTER COLUMN "enquiry_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "check_in";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "check_out";--> statement-breakpoint
ALTER TABLE "party_hall_enquiries" DROP COLUMN "date";