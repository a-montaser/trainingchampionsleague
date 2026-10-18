ALTER TABLE "entries" ALTER COLUMN "training_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "platform_other" text;