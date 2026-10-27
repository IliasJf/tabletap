CREATE TABLE `menu_images` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`content_type` text NOT NULL,
	`data` text NOT NULL,
	`byte_length` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `menu_images_owner_idx` ON `menu_images` (`owner_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `orders_owner_created_idx` ON `orders` (`owner_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `restaurant_catalogs` ADD `slug` text;--> statement-breakpoint
CREATE UNIQUE INDEX `restaurant_catalogs_slug_unique` ON `restaurant_catalogs` (`slug`);