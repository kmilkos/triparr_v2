CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `genres` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genres_name_unique` ON `genres` (`name`);--> statement-breakpoint
CREATE TABLE `media_files` (
	`id` text PRIMARY KEY NOT NULL,
	`media_item_id` text,
	`episode_id` text,
	`path` text NOT NULL,
	`size` integer NOT NULL,
	`duration` integer,
	`bitrate` integer,
	`container` text,
	`video_codec` text,
	`video_resolution` text,
	`video_width` integer,
	`video_height` integer,
	`video_fps` real,
	`scanned_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`episode_id`) REFERENCES `series_episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_files_path_unique` ON `media_files` (`path`);--> statement-breakpoint
CREATE TABLE `media_genres` (
	`media_item_id` text NOT NULL,
	`genre_id` integer NOT NULL,
	PRIMARY KEY(`media_item_id`, `genre_id`),
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media_items` (
	`id` text PRIMARY KEY NOT NULL,
	`tmdb_id` integer,
	`imdb_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`original_title` text,
	`sort_title` text,
	`tagline` text,
	`overview` text,
	`release_date` text,
	`status` text,
	`runtime` integer,
	`poster_path` text,
	`backdrop_path` text,
	`rating` real,
	`certification` text,
	`added_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_people` (
	`id` text PRIMARY KEY NOT NULL,
	`media_item_id` text NOT NULL,
	`episode_id` text,
	`person_id` text NOT NULL,
	`role` text NOT NULL,
	`character` text,
	`job` text,
	`display_order` integer,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`episode_id`) REFERENCES `series_episodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media_streams` (
	`id` text PRIMARY KEY NOT NULL,
	`media_file_id` text NOT NULL,
	`type` text NOT NULL,
	`stream_index` integer NOT NULL,
	`codec` text NOT NULL,
	`language` text,
	`title` text,
	`channels` integer,
	`is_default` integer DEFAULT false,
	`is_forced` integer DEFAULT false,
	FOREIGN KEY (`media_file_id`) REFERENCES `media_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media_studios` (
	`media_item_id` text NOT NULL,
	`studio_id` integer NOT NULL,
	PRIMARY KEY(`media_item_id`, `studio_id`),
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`studio_id`) REFERENCES `studios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`profile_path` text
);
--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`media_item_id` text NOT NULL,
	`episode_id` text,
	`status` text NOT NULL,
	`quality_profile` text DEFAULT 'Balanced' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`speed` integer,
	`eta` integer,
	`release_title` text,
	`release_size` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`media_item_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`episode_id`) REFERENCES `series_episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `series_episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`season_id` text NOT NULL,
	`episode_number` integer NOT NULL,
	`title` text NOT NULL,
	`overview` text,
	`runtime` integer,
	`still_path` text,
	`air_date` text,
	`rating` real,
	FOREIGN KEY (`season_id`) REFERENCES `series_seasons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `series_seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`series_id` text NOT NULL,
	`season_number` integer NOT NULL,
	`title` text,
	`overview` text,
	`episode_count` integer,
	`poster_path` text,
	`air_date` text,
	FOREIGN KEY (`series_id`) REFERENCES `media_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `studios` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studios_name_unique` ON `studios` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);