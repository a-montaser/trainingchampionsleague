CREATE TYPE "public"."job_role" AS ENUM('Product Owner', 'UI/UX Designer', 'Product Lead/Manager', 'Design Lead');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "job_role" "job_role";