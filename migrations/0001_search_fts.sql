-- Custom migration: full-text search (SQLite FTS5).
-- One index for all searchable entities, maintained by triggers.
-- NOTE: D1 cannot `wrangler d1 export` databases containing virtual tables;
-- backups use the app's own JSON export instead (see docs/RISKS.md R2).
-- The index is derived data: it can always be rebuilt from the source tables.
CREATE VIRTUAL TABLE `search_index` USING fts5(
	entity_type UNINDEXED,
	entity_id UNINDEXED,
	title,
	body,
	tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `notes_search_ai` AFTER INSERT ON `notes` BEGIN
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'note', new.id, new.title, new.content_text WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `notes_search_au` AFTER UPDATE OF title, content_text, deleted_at ON `notes` BEGIN
	DELETE FROM search_index WHERE entity_type = 'note' AND entity_id = old.id;
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'note', new.id, new.title, new.content_text WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `notes_search_ad` AFTER DELETE ON `notes` BEGIN
	DELETE FROM search_index WHERE entity_type = 'note' AND entity_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (entity_type, entity_id, title, body)
	SELECT 'note', id, title, content_text FROM `notes` WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE TRIGGER `tasks_search_ai` AFTER INSERT ON `tasks` BEGIN
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'task', new.id, new.title, coalesce(new.notes,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `tasks_search_au` AFTER UPDATE OF title, notes, deleted_at ON `tasks` BEGIN
	DELETE FROM search_index WHERE entity_type = 'task' AND entity_id = old.id;
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'task', new.id, new.title, coalesce(new.notes,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `tasks_search_ad` AFTER DELETE ON `tasks` BEGIN
	DELETE FROM search_index WHERE entity_type = 'task' AND entity_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (entity_type, entity_id, title, body)
	SELECT 'task', id, title, coalesce(notes,'') FROM `tasks` WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE TRIGGER `projects_search_ai` AFTER INSERT ON `projects` BEGIN
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'project', new.id, new.name, coalesce(new.description,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `projects_search_au` AFTER UPDATE OF name, description, deleted_at ON `projects` BEGIN
	DELETE FROM search_index WHERE entity_type = 'project' AND entity_id = old.id;
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'project', new.id, new.name, coalesce(new.description,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `projects_search_ad` AFTER DELETE ON `projects` BEGIN
	DELETE FROM search_index WHERE entity_type = 'project' AND entity_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (entity_type, entity_id, title, body)
	SELECT 'project', id, name, coalesce(description,'') FROM `projects` WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE TRIGGER `areas_search_ai` AFTER INSERT ON `areas` BEGIN
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'area', new.id, new.name, coalesce(new.description,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `areas_search_au` AFTER UPDATE OF name, description, deleted_at ON `areas` BEGIN
	DELETE FROM search_index WHERE entity_type = 'area' AND entity_id = old.id;
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'area', new.id, new.name, coalesce(new.description,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `areas_search_ad` AFTER DELETE ON `areas` BEGIN
	DELETE FROM search_index WHERE entity_type = 'area' AND entity_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (entity_type, entity_id, title, body)
	SELECT 'area', id, name, coalesce(description,'') FROM `areas` WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE TRIGGER `goals_search_ai` AFTER INSERT ON `goals` BEGIN
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'goal', new.id, new.title, coalesce(new.description,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `goals_search_au` AFTER UPDATE OF title, description, deleted_at ON `goals` BEGIN
	DELETE FROM search_index WHERE entity_type = 'goal' AND entity_id = old.id;
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'goal', new.id, new.title, coalesce(new.description,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `goals_search_ad` AFTER DELETE ON `goals` BEGIN
	DELETE FROM search_index WHERE entity_type = 'goal' AND entity_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (entity_type, entity_id, title, body)
	SELECT 'goal', id, title, coalesce(description,'') FROM `goals` WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE TRIGGER `resources_search_ai` AFTER INSERT ON `resources` BEGIN
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'resource', new.id, new.name, coalesce(new.description,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `resources_search_au` AFTER UPDATE OF name, description, deleted_at ON `resources` BEGIN
	DELETE FROM search_index WHERE entity_type = 'resource' AND entity_id = old.id;
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'resource', new.id, new.name, coalesce(new.description,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `resources_search_ad` AFTER DELETE ON `resources` BEGIN
	DELETE FROM search_index WHERE entity_type = 'resource' AND entity_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (entity_type, entity_id, title, body)
	SELECT 'resource', id, name, coalesce(description,'') FROM `resources` WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE TRIGGER `bookmarks_search_ai` AFTER INSERT ON `bookmarks` BEGIN
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'bookmark', new.id, new.title, coalesce(new.description,'') || ' ' || new.url WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `bookmarks_search_au` AFTER UPDATE OF title, description, url, deleted_at ON `bookmarks` BEGIN
	DELETE FROM search_index WHERE entity_type = 'bookmark' AND entity_id = old.id;
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'bookmark', new.id, new.title, coalesce(new.description,'') || ' ' || new.url WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `bookmarks_search_ad` AFTER DELETE ON `bookmarks` BEGIN
	DELETE FROM search_index WHERE entity_type = 'bookmark' AND entity_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (entity_type, entity_id, title, body)
	SELECT 'bookmark', id, title, coalesce(description,'') || ' ' || url FROM `bookmarks` WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE TRIGGER `books_search_ai` AFTER INSERT ON `books` BEGIN
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'book', new.id, new.title, coalesce(new.author,'') || ' ' || coalesce(new.summary,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `books_search_au` AFTER UPDATE OF title, author, summary, deleted_at ON `books` BEGIN
	DELETE FROM search_index WHERE entity_type = 'book' AND entity_id = old.id;
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'book', new.id, new.title, coalesce(new.author,'') || ' ' || coalesce(new.summary,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `books_search_ad` AFTER DELETE ON `books` BEGIN
	DELETE FROM search_index WHERE entity_type = 'book' AND entity_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (entity_type, entity_id, title, body)
	SELECT 'book', id, title, coalesce(author,'') || ' ' || coalesce(summary,'') FROM `books` WHERE deleted_at IS NULL;
