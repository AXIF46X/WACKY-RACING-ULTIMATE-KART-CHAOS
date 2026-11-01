CREATE TABLE "best_laps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"player_name" text NOT NULL,
	"track_id" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"lap_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"coins" integer DEFAULT 500 NOT NULL,
	"gems" integer DEFAULT 0 NOT NULL,
	"unlocked" jsonb NOT NULL,
	"upgrades" jsonb NOT NULL,
	"dailies" jsonb NOT NULL,
	"stats" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "race_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"track_id" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"position" integer NOT NULL,
	"field_size" integer NOT NULL,
	"total_ms" integer NOT NULL,
	"best_lap_ms" integer,
	"xp_earned" integer NOT NULL,
	"coins_earned" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "best_laps" ADD CONSTRAINT "best_laps_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;