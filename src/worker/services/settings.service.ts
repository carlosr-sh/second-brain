import { DEFAULT_SETTINGS, SETTINGS_SCHEMA, isSettingKey, type SettingKey, type Settings } from "../../shared/settings";
import { AppError } from "../lib/errors";
import type { SettingsRepository } from "../repositories/settings.repository";

export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {}

  /** Defaults merged with stored values. Stale/invalid stored values fall back to defaults. */
  async getAll(): Promise<Settings> {
    const stored = await this.repo.getAll();
    const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(SETTINGS_SCHEMA) as SettingKey[]) {
      if (!stored.has(key)) continue;
      const parsed = SETTINGS_SCHEMA[key].safeParse(stored.get(key));
      if (parsed.success) result[key] = parsed.data;
    }
    return result as Settings;
  }

  async set(key: string, value: unknown): Promise<Settings> {
    if (!isSettingKey(key)) throw new AppError(404, "NOT_FOUND", `Unknown setting '${key}'`);
    const parsed = SETTINGS_SCHEMA[key].parse(value); // ZodError → 400
    await this.repo.upsert(key, parsed);
    return this.getAll();
  }
}
