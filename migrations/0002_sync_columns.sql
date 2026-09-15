ALTER TABLE "change_requests" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "change_requests" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "change_requests" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "change_requests" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "time_slots" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "time_slots" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "time_slots" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "time_slots" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "time_slots" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "timetable" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "timetable" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "timetable" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "timetable" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "timetable" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "deleted_at" timestamp;