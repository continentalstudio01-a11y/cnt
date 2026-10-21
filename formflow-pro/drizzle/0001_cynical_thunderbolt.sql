CREATE INDEX `records_owner_kind` ON `records` (`owner`,`kind`);--> statement-breakpoint
CREATE INDEX `records_parent_kind` ON `records` (`parent`,`kind`);