CREATE TABLE "room_type_settings" (
	"type" text PRIMARY KEY NOT NULL,
	"area_sqm" integer NOT NULL,
	"price_per_night" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"no" text PRIMARY KEY NOT NULL,
	"floor" integer NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"detail" text DEFAULT 'Ready' NOT NULL
);
