CREATE TABLE `delivery_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`lead` text NOT NULL,
	`provider` text NOT NULL,
	`payload` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_at` integer DEFAULT 0 NOT NULL,
	`status_code` integer DEFAULT 0 NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jobs_due` ON `delivery_jobs` (`state`,`next_at`);--> statement-breakpoint
CREATE INDEX `jobs_owner` ON `delivery_jobs` (`owner`,`created`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workspace_email` ON `workspace_members` (`email`);--> statement-breakpoint
CREATE INDEX `workspace_owner` ON `workspace_members` (`owner`);--> statement-breakpoint
CREATE TABLE `flow_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `flow_rates_expiry` ON `flow_rates` (`expires`);--> statement-breakpoint
CREATE TABLE `flow_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`form` text NOT NULL,
	`owner` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`path` text DEFAULT '[]' NOT NULL,
	`source` text DEFAULT '{}' NOT NULL,
	`device` text DEFAULT 'Computador' NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `flow_session_form` ON `flow_sessions` (`form`,`updated`);--> statement-breakpoint
CREATE INDEX `flow_session_owner` ON `flow_sessions` (`owner`,`created`);