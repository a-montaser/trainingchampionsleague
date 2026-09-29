CREATE TABLE "people_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_managers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "manager_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_manager_id_people_managers_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."people_managers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
--
-- Carry over the org chart that was previously hard-coded, so the mapping is
-- unchanged the moment it becomes editable. Shaimaa Dwedar is the lead: every
-- Product Lead/Manager and Design Lead reports to her whatever their team.
--
INSERT INTO "people_managers" ("name", "is_lead") VALUES
  ('Mayar AbdElGaleel', false),
  ('Rehab Arafa',       false),
  ('Khalid Osama',      false),
  ('Maya Ammar',        false),
  ('Yousef Askar',      false),
  ('Shaimaa Dwedar',    true)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint

UPDATE "teams" SET "manager_id" = (SELECT "id" FROM "people_managers" WHERE "name" = 'Mayar AbdElGaleel')
  WHERE "name" IN ('Vodacom', 'Mpesa', 'Ireland', 'DE enterprise');--> statement-breakpoint
UPDATE "teams" SET "manager_id" = (SELECT "id" FROM "people_managers" WHERE "name" = 'Rehab Arafa')
  WHERE "name" IN ('OneApp', 'CIT');--> statement-breakpoint
UPDATE "teams" SET "manager_id" = (SELECT "id" FROM "people_managers" WHERE "name" = 'Khalid Osama')
  WHERE "name" IN ('Web factory');--> statement-breakpoint
UPDATE "teams" SET "manager_id" = (SELECT "id" FROM "people_managers" WHERE "name" = 'Maya Ammar')
  WHERE "name" IN ('MVA Germany', 'UK MVA/Web');--> statement-breakpoint
UPDATE "teams" SET "manager_id" = (SELECT "id" FROM "people_managers" WHERE "name" = 'Yousef Askar')
  WHERE "name" IN ('DE portals');
