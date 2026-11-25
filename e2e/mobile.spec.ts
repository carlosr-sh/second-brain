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

test("home-screen shortcut /?capture=1 opens quick capture and cleans the URL", async ({ page }) => {
  await resetSettings(page);
  await page.goto("/?capture=1");
  await expect(page.getByRole("textbox", { name: "Conteúdo da captura" })).toBeFocused();
  await expect(page).toHaveURL(/\/$/);
});

test("no horizontal overflow on the main mobile screens", async ({ page }) => {
  await resetSettings(page);
  for (const path of ["/", "/tasks", "/notes", "/finance", "/finance?tab=transactions", "/habits", "/journal", "/contacts", "/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
  }
});

test("offline: banner, read-only editor and a clear message when saving", async ({ page, context }) => {
  await resetSettings(page);
  // A note to read offline.
  const note = await page.evaluate(() =>
    fetch("/api/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Offline E2E" }) })
      .then((r) => r.json())
      .then((b) => b.data as { id: string }),
  );
  await page.goto(`/notes/${note.id}`);
  await expect(page.locator(".ProseMirror")).toHaveAttribute("contenteditable", "true");

  // Network gone. navigator.onLine may stay true (as on Wi-Fi without
  // internet): the first failed request is what flips the app offline.
  await context.setOffline(true);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Tarefas" }).click();
  const banner = page.getByRole("status").filter({ hasText: "Sem conexão" });
  await expect(banner).toBeVisible();

  await page.goBack();
  await expect(page.locator(".ProseMirror")).toHaveAttribute("contenteditable", "false");

  await page.getByRole("button", { name: "Captura rápida" }).first().click();
  await page.getByRole("textbox", { name: "Conteúdo da captura" }).fill("não deve salvar");
  await page.getByRole("button", { name: "Capturar" }).click();
  await expect(page.getByText("Sem conexão — nada foi salvo")).toBeVisible();
  await page.keyboard.press("Escape");

  // Back online (the OS fires "online"): banner goes, editing comes back.
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(banner).toBeHidden();
  await expect(page.locator(".ProseMirror")).toHaveAttribute("contenteditable", "true");
});
