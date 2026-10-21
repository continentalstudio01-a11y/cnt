CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`parent` text DEFAULT '' NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL
);
