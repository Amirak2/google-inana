CREATE TABLE `site_records` (
	`bucket` text NOT NULL,
	`record_key` text NOT NULL,
	`value_json` text NOT NULL,
	PRIMARY KEY(`bucket`, `record_key`)
);
--> statement-breakpoint
CREATE TABLE `site_revision` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`lease_token` text DEFAULT '' NOT NULL
);
