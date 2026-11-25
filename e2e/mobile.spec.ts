import { expect, test } from "@playwright/test";
import { resetSettings } from "./helpers";

test("mobile drawer navigates and closes; no horizontal overflow", async ({ page }) => {
  await resetSettings(page);
  await page.goto("/inbox");
  await expect(page.locator("aside")).toBeHidden();
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(page.getByRole("tooltip")).toHaveCount(0); // regression: no focus tooltip on open
  await drawer.getByRole("link", { name: "Tarefas" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(drawer).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("mobile quick capture from the top bar", async ({ page }) => {
  await resetSettings(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Captura rápida" }).first().click();
  await expect(page.getByRole("textbox", { name: "Conteúdo da captura" })).toBeFocused();
});
