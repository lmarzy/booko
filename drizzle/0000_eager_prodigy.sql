CREATE TABLE `club_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`club_id` integer NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_club_members_club_email` ON `club_members` (`club_id`,`email`);--> statement-breakpoint
CREATE TABLE `clubs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`host_user_id` text NOT NULL,
	`name` text NOT NULL,
	`book_title` text NOT NULL,
	`author` text NOT NULL,
	`meeting_date` text NOT NULL,
	`reading_pace` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`host_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_clubs_host_created` ON `clubs` (`host_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
PRAGMA optimize;
