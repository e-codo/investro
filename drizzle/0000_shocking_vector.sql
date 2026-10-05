CREATE TABLE "asset_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"weight" smallint NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "asset_classes_weight_range" CHECK ("asset_classes"."weight" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"subject" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount_kopecks" bigint NOT NULL,
	CONSTRAINT "coupons_unique" UNIQUE("user_id","instrument_id","date","amount_kopecks")
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"type" text NOT NULL,
	"class_id" uuid,
	CONSTRAINT "instruments_user_key_unique" UNIQUE("user_id","name_key")
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_kopecks" bigint NOT NULL,
	CONSTRAINT "milestones_positive" CHECK ("milestones"."amount_kopecks" > 0)
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"value_kopecks" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text NOT NULL,
	"quote" text NOT NULL,
	"goal_kopecks" bigint NOT NULL,
	"deposit_rate" numeric(5, 2) DEFAULT '14' NOT NULL,
	"inflation" numeric(5, 2) DEFAULT '6.5' NOT NULL,
	"strategy_enabled" boolean DEFAULT true NOT NULL,
	"strategy_name" text,
	"blocks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "settings_goal_positive" CHECK ("settings"."goal_kopecks" > 0)
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"value_kopecks" bigint NOT NULL,
	"cash_kopecks" bigint NOT NULL,
	"report_deposit_kopecks" bigint NOT NULL,
	"contribution_kopecks" bigint NOT NULL,
	"deduction_kopecks" bigint DEFAULT 0 NOT NULL,
	"withdrawal_kopecks" bigint DEFAULT 0 NOT NULL,
	"fees_kopecks" bigint DEFAULT 0 NOT NULL,
	"taxes_kopecks" bigint DEFAULT 0 NOT NULL,
	"flow_date" date NOT NULL,
	"source" text NOT NULL,
	"parser_version" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshots_user_month_unique" UNIQUE("user_id","month"),
	CONSTRAINT "snapshots_amounts_nonneg" CHECK ("snapshots"."contribution_kopecks" >= 0 and "snapshots"."deduction_kopecks" >= 0 and "snapshots"."withdrawal_kopecks" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "asset_classes" ADD CONSTRAINT "asset_classes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_class_id_asset_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."asset_classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_classes_user_idx" ON "asset_classes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_attempts_lookup_idx" ON "auth_attempts" USING btree ("kind","subject","at");--> statement-breakpoint
CREATE INDEX "coupons_user_idx" ON "coupons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "instruments_user_idx" ON "instruments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "milestones_user_idx" ON "milestones" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "positions_snapshot_idx" ON "positions" USING btree ("snapshot_id");