import { z } from "zod";

/**
 * Registry of user preferences stored in the `settings` table.
 * Each key has a schema and a default. The server rejects unknown keys and
 * invalid values; the client gets precise types for every key.
 */
export const SETTINGS_SCHEMA = {
  "appearance.theme": z.enum(["system", "light", "dark"]),
  "layout.sidebarCollapsed": z.boolean(),
} as const;

export type SettingKey = keyof typeof SETTINGS_SCHEMA;
export type Settings = { [K in SettingKey]: z.infer<(typeof SETTINGS_SCHEMA)[K]> };
export type ThemePreference = Settings["appearance.theme"];

export const DEFAULT_SETTINGS: Settings = {
  "appearance.theme": "system",
  "layout.sidebarCollapsed": false,
};

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTINGS_SCHEMA, key);
}
