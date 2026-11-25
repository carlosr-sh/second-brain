import type { CreateInboxItemInput, InboxItem, InboxStatusFilter, UpdateInboxItemInput } from "../../shared/inbox";
import { notFound } from "../lib/errors";
import type { InboxItemRow, InboxRepository } from "../repositories/inbox.repository";

/**
 * Inbox = raw quick captures awaiting triage. Turning an item into a task or
 * note arrives with those modules (Phase 3/4); here it can be marked
 * processed, reopened or moved to the trash (soft delete).
 */
export class InboxService {
  constructor(private readonly repo: InboxRepository) {}

  async list(status: InboxStatusFilter): Promise<InboxItem[]> {
    return (await this.repo.list(status)).map(toDto);
  }

  countOpen(): Promise<number> {
    return this.repo.countOpen();
  }

  async capture(input: CreateInboxItemInput): Promise<InboxItem> {
    return toDto(await this.repo.create({ content: input.content, url: input.url ?? null }));
  }

  async update(id: string, input: UpdateInboxItemInput): Promise<InboxItem> {
    const row = await this.repo.update(id, { processedAt: input.processed ? new Date() : null });
    if (!row) throw notFound("Inbox item not found");
    return toDto(row);
  }

  async trash(id: string): Promise<void> {
    const row = await this.repo.update(id, { deletedAt: new Date() });
    if (!row) throw notFound("Inbox item not found");
  }
}

function toDto(row: InboxItemRow): InboxItem {
  return {
    id: row.id,
    content: row.content,
    url: row.url,
    processedAt: row.processedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
