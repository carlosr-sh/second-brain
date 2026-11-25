-- Custom migration: full-text search for Phase 5 entities (journal, contacts, transactions).
-- Same pattern as 0001_search_fts.sql.
CREATE TRIGGER `journal_entries_search_ai` AFTER INSERT ON `journal_entries` BEGIN
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'journal', new.id, new.entry_date || ' ' || coalesce(new.title,''), new.content_text WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `journal_entries_search_au` AFTER UPDATE OF entry_date, title, content_text, deleted_at ON `journal_entries` BEGIN
	DELETE FROM search_index WHERE entity_type = 'journal' AND entity_id = old.id;
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'journal', new.id, new.entry_date || ' ' || coalesce(new.title,''), new.content_text WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `journal_entries_search_ad` AFTER DELETE ON `journal_entries` BEGIN
	DELETE FROM search_index WHERE entity_type = 'journal' AND entity_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (entity_type, entity_id, title, body)
	SELECT 'journal', id, entry_date || ' ' || coalesce(title,''), content_text FROM `journal_entries` WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE TRIGGER `contacts_search_ai` AFTER INSERT ON `contacts` BEGIN
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'contact', new.id, new.name, coalesce(new.nickname,'') || ' ' || coalesce(new.company,'') || ' ' || coalesce(new.job_title,'') || ' ' || coalesce(new.email,'') || ' ' || coalesce(new.notes,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `contacts_search_au` AFTER UPDATE OF name, nickname, company, job_title, email, notes, deleted_at ON `contacts` BEGIN
	DELETE FROM search_index WHERE entity_type = 'contact' AND entity_id = old.id;
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'contact', new.id, new.name, coalesce(new.nickname,'') || ' ' || coalesce(new.company,'') || ' ' || coalesce(new.job_title,'') || ' ' || coalesce(new.email,'') || ' ' || coalesce(new.notes,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `contacts_search_ad` AFTER DELETE ON `contacts` BEGIN
	DELETE FROM search_index WHERE entity_type = 'contact' AND entity_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (entity_type, entity_id, title, body)
	SELECT 'contact', id, name, coalesce(nickname,'') || ' ' || coalesce(company,'') || ' ' || coalesce(job_title,'') || ' ' || coalesce(email,'') || ' ' || coalesce(notes,'') FROM `contacts` WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE TRIGGER `transactions_search_ai` AFTER INSERT ON `transactions` BEGIN
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'transaction', new.id, new.description, coalesce(new.notes,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `transactions_search_au` AFTER UPDATE OF description, notes, deleted_at ON `transactions` BEGIN
	DELETE FROM search_index WHERE entity_type = 'transaction' AND entity_id = old.id;
	INSERT INTO search_index (entity_type, entity_id, title, body) SELECT 'transaction', new.id, new.description, coalesce(new.notes,'') WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `transactions_search_ad` AFTER DELETE ON `transactions` BEGIN
	DELETE FROM search_index WHERE entity_type = 'transaction' AND entity_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (entity_type, entity_id, title, body)
	SELECT 'transaction', id, description, coalesce(notes,'') FROM `transactions` WHERE deleted_at IS NULL;
