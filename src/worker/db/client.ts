import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = DrizzleD1Database<typeof schema>;

/** Cheap to create; one instance per request. */
export function createDb(d1: D1Database): Database {
  return drizzle(d1, { schema });
}
