CREATE TABLE "crowd_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"queue_id" integer NOT NULL,
	"kind" text NOT NULL,
	"entry_point_id" integer,
	"joined_at" timestamp with time zone,
	"darshan_at" timestamp with time zone,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"heuristic_low_minutes" integer,
	"heuristic_high_minutes" integer,
	"heuristic_provenance" text
);
--> statement-breakpoint
CREATE TABLE "mandals" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_mr" text,
	"name_hi" text,
	"area" text NOT NULL,
	"tier" text NOT NULL,
	"idol_lat" double precision,
	"idol_lng" double precision,
	"nearest_station" text,
	"station_walk_minutes" integer,
	"notes" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "mandals_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "queue_entry_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"queue_id" integer NOT NULL,
	"sequence" integer NOT NULL,
	"landmark" text NOT NULL,
	"landmark_mr" text,
	"lat" double precision,
	"lng" double precision,
	"implied_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "queues" (
	"id" serial PRIMARY KEY NOT NULL,
	"mandal_id" integer NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"label_mr" text,
	"entry_lat" double precision,
	"entry_lng" double precision,
	"base_minutes" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crowd_reports" ADD CONSTRAINT "crowd_reports_queue_id_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crowd_reports" ADD CONSTRAINT "crowd_reports_entry_point_id_queue_entry_points_id_fk" FOREIGN KEY ("entry_point_id") REFERENCES "public"."queue_entry_points"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entry_points" ADD CONSTRAINT "queue_entry_points_queue_id_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queues" ADD CONSTRAINT "queues_mandal_id_mandals_id_fk" FOREIGN KEY ("mandal_id") REFERENCES "public"."mandals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_queue_status_time_idx" ON "crowd_reports" USING btree ("queue_id","status","reported_at");--> statement-breakpoint
CREATE INDEX "qep_queue_idx" ON "queue_entry_points" USING btree ("queue_id");--> statement-breakpoint
CREATE INDEX "queues_mandal_idx" ON "queues" USING btree ("mandal_id");