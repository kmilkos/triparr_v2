CREATE TABLE `libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `libraries_path_unique` ON `libraries` (`path`);--> statement-breakpoint
ALTER TABLE `media_files` ADD `library_id` text REFERENCES libraries(id);--> statement-breakpoint
ALTER TABLE `requests` ADD `library_id` text REFERENCES libraries(id);