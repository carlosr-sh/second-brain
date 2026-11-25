import type { Page } from "@playwright/test";

/** Resets persisted preferences so every test starts from the same UI state. */
export async function resetSettings(page: Page) {
  await page.goto("/api/health");
  for (const [key, value] of [["layout.sidebarCollapsed", false], ["appearance.theme", "light"]] as const) {
    await page.evaluate(
      ([k, v]) => fetch(`/api/settings/${k}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: v }) }),
      [key, value] as const,
    );
  }
}

export const uniq = (label: string) => `${label} ${Date.now().toString(36)}`;
