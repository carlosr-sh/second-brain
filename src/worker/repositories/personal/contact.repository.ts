import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { contactInteractions, contacts } from "../../db/schema";

export type ContactRow = typeof contacts.$inferSelect;

const C = sql.raw("contacts.id");

export class ContactRepository {
  constructor(private readonly db: Database) {}

  private select() {
    return this.db
      .select({ contact: contacts, lastContactedAt: sql<number | null>`(select max(i.occurred_at) from contact_interactions i where i.contact_id = ${C})` })
      .from(contacts);
  }

  list(archived: boolean) {
    return this.select()
      .where(and(isNull(contacts.deletedAt), archived ? isNotNull(contacts.archivedAt) : isNull(contacts.archivedAt)))
      .orderBy(asc(sql`${contacts.name} collate nocase`));
  }

  async findWithLast(id: string) {
    const [row] = await this.select().where(eq(contacts.id, id));
    return row;
  }

  async findById(id: string): Promise<ContactRow | undefined> {
    const [row] = await this.db.select().from(contacts).where(eq(contacts.id, id));
    return row;
  }

  interactions(contactId: string) {
    return this.db.select().from(contactInteractions).where(eq(contactInteractions.contactId, contactId)).orderBy(desc(contactInteractions.occurredAt)).limit(500);
  }

  async addInteraction(values: typeof contactInteractions.$inferInsert) {
    const [row] = await this.db.insert(contactInteractions).values(values).returning();
    if (!row) throw new Error("interaction insert returned no row");
    return row;
  }

  async deleteInteraction(contactId: string, id: string): Promise<boolean> {
    const rows = await this.db.delete(contactInteractions).where(and(eq(contactInteractions.id, id), eq(contactInteractions.contactId, contactId))).returning({ id: contactInteractions.id });
    return rows.length > 0;
  }

  async insert(values: typeof contacts.$inferInsert): Promise<ContactRow> {
    const [row] = await this.db.insert(contacts).values(values).returning();
    if (!row) throw new Error("contact insert returned no row");
    return row;
  }

  async update(id: string, values: Partial<typeof contacts.$inferInsert>) {
    await this.db.update(contacts).set(values).where(eq(contacts.id, id));
  }

  async purge(id: string) {
    await this.db.delete(contacts).where(eq(contacts.id, id)); // interactions cascade; transactions.contact_id set null
  }
}
