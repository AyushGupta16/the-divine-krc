CREATE TABLE "gst_rate_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"rate_type" text NOT NULL,
	"from_pct" integer NOT NULL,
	"to_pct" integer NOT NULL,
	"changed_by" text,
	"changed_at" timestamp with time zone NOT NULL
);
