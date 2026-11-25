CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_nocase_uq` ON `tags` ("name" collate nocase);--> statement-breakpoint
CREATE TABLE `areas` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`color` text,
	`position` real DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `areas_position_idx` ON `areas` (`position`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`area_id` text,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'not_started' NOT NULL,
	`horizon` text DEFAULT 'quarter' NOT NULL,
	`target_date` text,
	`achieved_at` integer,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "goals_status_ck" CHECK("goals"."status" in ('not_started', 'in_progress', 'achieved', 'abandoned')),
	CONSTRAINT "goals_horizon_ck" CHECK("goals"."horizon" in ('week', 'month', 'quarter', 'year', 'long_term')),
	CONSTRAINT "goals_target_date_ck" CHECK("goals"."target_date" is null or (length("goals"."target_date") = 10 and "goals"."target_date" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'))
);
--> statement-breakpoint
CREATE INDEX `goals_area_idx` ON `goals` (`area_id`);--> statement-breakpoint
CREATE INDEX `goals_status_idx` ON `goals` (`status`);--> statement-breakpoint
CREATE TABLE `inbox_items` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`url` text,
	`processed_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inbox_items_processed_idx` ON `inbox_items` (`processed_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_tags` (
	`project_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`project_id`, `tag_id`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_tags_tag_idx` ON `project_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`area_id` text,
	`goal_id` text,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`priority` text DEFAULT 'none' NOT NULL,
	`start_date` text,
	`due_date` text,
	`completed_at` integer,
	`position` real DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "projects_status_ck" CHECK("projects"."status" in ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
	CONSTRAINT "projects_priority_ck" CHECK("projects"."priority" in ('none', 'low', 'medium', 'high', 'urgent')),
	CONSTRAINT "projects_start_date_ck" CHECK("projects"."start_date" is null or (length("projects"."start_date") = 10 and "projects"."start_date" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')),
	CONSTRAINT "projects_due_date_ck" CHECK("projects"."due_date" is null or (length("projects"."due_date") = 10 and "projects"."due_date" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'))
);
--> statement-breakpoint
CREATE INDEX `projects_area_idx` ON `projects` (`area_id`);--> statement-breakpoint
CREATE INDEX `projects_goal_idx` ON `projects` (`goal_id`);--> statement-breakpoint
CREATE INDEX `projects_status_idx` ON `projects` (`status`,`position`);--> statement-breakpoint
CREATE INDEX `projects_due_idx` ON `projects` (`due_date`);--> statement-breakpoint
CREATE TABLE `task_tags` (
	`task_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `tag_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_tags_tag_idx` ON `task_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`area_id` text,
	`parent_task_id` text,
	`title` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'none' NOT NULL,
	`due_date` text,
	`scheduled_date` text,
	`recurrence_rule` text,
	`completed_at` integer,
	`position` real DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tasks_status_ck" CHECK("tasks"."status" in ('todo', 'in_progress', 'waiting', 'done', 'cancelled')),
	CONSTRAINT "tasks_priority_ck" CHECK("tasks"."priority" in ('none', 'low', 'medium', 'high', 'urgent')),
	CONSTRAINT "tasks_due_date_ck" CHECK("tasks"."due_date" is null or (length("tasks"."due_date") = 10 and "tasks"."due_date" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')),
	CONSTRAINT "tasks_scheduled_date_ck" CHECK("tasks"."scheduled_date" is null or (length("tasks"."scheduled_date") = 10 and "tasks"."scheduled_date" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')),
	CONSTRAINT "tasks_single_location_ck" CHECK((("tasks"."project_id" is not null) + ("tasks"."area_id" is not null)) <= 1),
	CONSTRAINT "tasks_not_own_parent_ck" CHECK("tasks"."parent_task_id" is null or "tasks"."parent_task_id" <> "tasks"."id")
);
--> statement-breakpoint
CREATE INDEX `tasks_project_idx` ON `tasks` (`project_id`);--> statement-breakpoint
CREATE INDEX `tasks_area_idx` ON `tasks` (`area_id`);--> statement-breakpoint
CREATE INDEX `tasks_parent_idx` ON `tasks` (`parent_task_id`);--> statement-breakpoint
CREATE INDEX `tasks_status_position_idx` ON `tasks` (`status`,`position`);--> statement-breakpoint
CREATE INDEX `tasks_due_idx` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE INDEX `tasks_scheduled_idx` ON `tasks` (`scheduled_date`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`original_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "files_size_ck" CHECK("files"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_r2_key_uq` ON `files` (`r2_key`);--> statement-breakpoint
CREATE INDEX `files_sha256_idx` ON `files` (`sha256`);--> statement-breakpoint
CREATE TABLE `book_notes` (
	`book_id` text NOT NULL,
	`note_id` text NOT NULL,
	PRIMARY KEY(`book_id`, `note_id`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_notes_note_idx` ON `book_notes` (`note_id`);--> statement-breakpoint
CREATE TABLE `book_tags` (
	`book_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`book_id`, `tag_id`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_tags_tag_idx` ON `book_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `bookmark_tags` (
	`bookmark_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`bookmark_id`, `tag_id`),
	FOREIGN KEY (`bookmark_id`) REFERENCES `bookmarks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bookmark_tags_tag_idx` ON `bookmark_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`read_at` integer,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `bookmarks_resource_idx` ON `bookmarks` (`resource_id`);--> statement-breakpoint
CREATE INDEX `bookmarks_url_idx` ON `bookmarks` (`url`);--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text,
	`cover_file_id` text,
	`title` text NOT NULL,
	`author` text,
	`isbn` text,
	`page_count` integer,
	`status` text DEFAULT 'want_to_read' NOT NULL,
	`rating` integer,
	`started_on` text,
	`finished_on` text,
	`summary` text,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cover_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "books_status_ck" CHECK("books"."status" in ('want_to_read', 'reading', 'finished', 'abandoned')),
	CONSTRAINT "books_rating_ck" CHECK("books"."rating" is null or "books"."rating" between 1 and 5),
	CONSTRAINT "books_page_count_ck" CHECK("books"."page_count" is null or "books"."page_count" > 0),
	CONSTRAINT "books_started_on_ck" CHECK("books"."started_on" is null or (length("books"."started_on") = 10 and "books"."started_on" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')),
	CONSTRAINT "books_finished_on_ck" CHECK("books"."finished_on" is null or (length("books"."finished_on") = 10 and "books"."finished_on" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'))
);
--> statement-breakpoint
CREATE INDEX `books_status_idx` ON `books` (`status`);--> statement-breakpoint
CREATE TABLE `note_attachments` (
	`note_id` text NOT NULL,
	`file_id` text NOT NULL,
	PRIMARY KEY(`note_id`, `file_id`),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_attachments_file_idx` ON `note_attachments` (`file_id`);--> statement-breakpoint
CREATE TABLE `note_links` (
	`source_note_id` text NOT NULL,
	`target_note_id` text NOT NULL,
	PRIMARY KEY(`source_note_id`, `target_note_id`),
	FOREIGN KEY (`source_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "note_links_no_self_ck" CHECK("note_links"."source_note_id" <> "note_links"."target_note_id")
);
--> statement-breakpoint
CREATE INDEX `note_links_target_idx` ON `note_links` (`target_note_id`);--> statement-breakpoint
CREATE TABLE `note_tags` (
	`note_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`note_id`, `tag_id`),
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_tags_tag_idx` ON `note_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `notebooks` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`position` real DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "notebooks_not_own_parent_ck" CHECK("notebooks"."parent_id" is null or "notebooks"."parent_id" <> "notebooks"."id")
);
--> statement-breakpoint
CREATE INDEX `notebooks_parent_idx` ON `notebooks` (`parent_id`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`notebook_id` text,
	`project_id` text,
	`area_id` text,
	`resource_id` text,
	`title` text DEFAULT '' NOT NULL,
	`content_json` text,
	`content_text` text DEFAULT '' NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `notebooks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resource_id`) REFERENCES `resources`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "notes_single_location_ck" CHECK((("notes"."project_id" is not null) + ("notes"."area_id" is not null) + ("notes"."resource_id" is not null)) <= 1)
);
--> statement-breakpoint
CREATE INDEX `notes_notebook_idx` ON `notes` (`notebook_id`);--> statement-breakpoint
CREATE INDEX `notes_project_idx` ON `notes` (`project_id`);--> statement-breakpoint
CREATE INDEX `notes_area_idx` ON `notes` (`area_id`);--> statement-breakpoint
CREATE INDEX `notes_resource_idx` ON `notes` (`resource_id`);--> statement-breakpoint
CREATE INDEX `notes_updated_idx` ON `notes` (`updated_at`);--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`area_id` text,
	`name` text NOT NULL,
	`description` text,
	`icon` text,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `resources_area_idx` ON `resources` (`area_id`);--> statement-breakpoint
CREATE TABLE `contact_interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`type` text DEFAULT 'other' NOT NULL,
	`occurred_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "contact_interactions_type_ck" CHECK("contact_interactions"."type" in ('call', 'meeting', 'message', 'email', 'event', 'other'))
);
--> statement-breakpoint
CREATE INDEX `contact_interactions_contact_idx` ON `contact_interactions` (`contact_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`nickname` text,
	`email` text,
	`phone` text,
	`company` text,
	`job_title` text,
	`relationship` text DEFAULT 'other' NOT NULL,
	`birthday` text,
	`notes` text,
	`contact_frequency_days` integer,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "contacts_relationship_ck" CHECK("contacts"."relationship" in ('family', 'friend', 'colleague', 'client', 'mentor', 'acquaintance', 'other')),
	CONSTRAINT "contacts_birthday_ck" CHECK("contacts"."birthday" is null or (length("contacts"."birthday") = 10 and "contacts"."birthday" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')),
	CONSTRAINT "contacts_frequency_ck" CHECK("contacts"."contact_frequency_days" is null or "contacts"."contact_frequency_days" > 0)
);
--> statement-breakpoint
CREATE INDEX `contacts_name_idx` ON `contacts` (`name`);--> statement-breakpoint
CREATE TABLE `habit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "habit_logs_date_ck" CHECK("habit_logs"."date" is null or (length("habit_logs"."date") = 10 and "habit_logs"."date" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')),
	CONSTRAINT "habit_logs_count_ck" CHECK("habit_logs"."count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `habit_logs_habit_date_uq` ON `habit_logs` (`habit_id`,`date`);--> statement-breakpoint
CREATE INDEX `habit_logs_date_idx` ON `habit_logs` (`date`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`area_id` text,
	`goal_id` text,
	`name` text NOT NULL,
	`description` text,
	`frequency` text DEFAULT 'daily' NOT NULL,
	`target_count` integer DEFAULT 1 NOT NULL,
	`color` text,
	`icon` text,
	`started_on` text,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "habits_frequency_ck" CHECK("habits"."frequency" in ('daily', 'weekly', 'monthly')),
	CONSTRAINT "habits_target_ck" CHECK("habits"."target_count" >= 1),
	CONSTRAINT "habits_started_on_ck" CHECK("habits"."started_on" is null or (length("habits"."started_on") = 10 and "habits"."started_on" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'))
);
--> statement-breakpoint
CREATE INDEX `habits_area_idx` ON `habits` (`area_id`);--> statement-breakpoint
CREATE INDEX `habits_goal_idx` ON `habits` (`goal_id`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_date` text NOT NULL,
	`title` text,
	`content_json` text,
	`content_text` text DEFAULT '' NOT NULL,
	`mood` integer,
	`energy` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "journal_entries_date_ck" CHECK("journal_entries"."entry_date" is null or (length("journal_entries"."entry_date") = 10 and "journal_entries"."entry_date" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')),
	CONSTRAINT "journal_entries_mood_ck" CHECK("journal_entries"."mood" is null or "journal_entries"."mood" between 1 and 5),
	CONSTRAINT "journal_entries_energy_ck" CHECK("journal_entries"."energy" is null or "journal_entries"."energy" between 1 and 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journal_entries_date_live_uq` ON `journal_entries` (`entry_date`) WHERE "journal_entries"."deleted_at" is null;--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'checking' NOT NULL,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`opening_balance_cents` integer DEFAULT 0 NOT NULL,
	`institution` text,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "accounts_type_ck" CHECK("accounts"."type" in ('checking', 'savings', 'credit_card', 'cash', 'investment', 'other')),
	CONSTRAINT "accounts_currency_ck" CHECK(length("accounts"."currency") = 3 and "accounts"."currency" = upper("accounts"."currency"))
);
--> statement-breakpoint
CREATE TABLE `financial_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`color` text,
	`icon` text,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `financial_categories`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "financial_categories_kind_ck" CHECK("financial_categories"."kind" in ('income', 'expense')),
	CONSTRAINT "financial_categories_not_own_parent_ck" CHECK("financial_categories"."parent_id" is null or "financial_categories"."parent_id" <> "financial_categories"."id")
);
--> statement-breakpoint
CREATE INDEX `financial_categories_parent_idx` ON `financial_categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`contact_id` text,
	`receipt_file_id` text,
	`kind` text NOT NULL,
	`status` text DEFAULT 'cleared' NOT NULL,
	`amount_cents` integer NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`notes` text,
	`transfer_group_id` text,
	`deleted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `financial_categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`receipt_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transactions_kind_ck" CHECK("transactions"."kind" in ('income', 'expense', 'transfer', 'adjustment')),
	CONSTRAINT "transactions_status_ck" CHECK("transactions"."status" in ('pending', 'cleared')),
	CONSTRAINT "transactions_date_ck" CHECK("transactions"."date" is null or (length("transactions"."date") = 10 and "transactions"."date" glob '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')),
	CONSTRAINT "transactions_amount_nonzero_ck" CHECK("transactions"."amount_cents" <> 0),
	CONSTRAINT "transactions_sign_ck" CHECK(("transactions"."kind" = 'income' and "transactions"."amount_cents" > 0) or ("transactions"."kind" = 'expense' and "transactions"."amount_cents" < 0) or "transactions"."kind" in ('transfer', 'adjustment')),
	CONSTRAINT "transactions_transfer_group_ck" CHECK(("transactions"."kind" = 'transfer') = ("transactions"."transfer_group_id" is not null))
);
--> statement-breakpoint
CREATE INDEX `transactions_account_date_idx` ON `transactions` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_category_date_idx` ON `transactions` (`category_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_transfer_group_idx` ON `transactions` (`transfer_group_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`actor_email` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`request_id` text,
	`ip_address` text,
	`user_agent` text,
	`metadata` text
);
--> statement-breakpoint
CREATE INDEX `audit_logs_occurred_idx` ON `audit_logs` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `backup_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`finished_at` integer,
	`location` text,
	`size_bytes` integer,
	`item_count` integer,
	`checksum` text,
	`error` text,
	`metadata` text,
	CONSTRAINT "backup_runs_kind_ck" CHECK("backup_runs"."kind" in ('json_export', 'markdown_export', 'r2_mirror', 'd1_time_travel_bookmark', 'restore', 'integrity_check')),
	CONSTRAINT "backup_runs_status_ck" CHECK("backup_runs"."status" in ('running', 'succeeded', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `backup_runs_kind_started_idx` ON `backup_runs` (`kind`,`started_at`);--> statement-breakpoint
CREATE TABLE `saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`module` text NOT NULL,
	`name` text NOT NULL,
	`layout` text DEFAULT 'list' NOT NULL,
	`filters` text NOT NULL,
	`sort` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "saved_views_layout_ck" CHECK("saved_views"."layout" in ('list', 'table', 'board', 'calendar', 'gallery'))
);
--> statement-breakpoint
CREATE INDEX `saved_views_module_idx` ON `saved_views` (`module`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
