CREATE TABLE "notification_reads" (
	"member_email" text PRIMARY KEY NOT NULL,
	"last_read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_member_email_team_email_fk" FOREIGN KEY ("member_email") REFERENCES "public"."team"("email") ON DELETE no action ON UPDATE no action;