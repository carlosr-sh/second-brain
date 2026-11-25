import { expect, test } from "@playwright/test";
import { resetSettings, uniq } from "./helpers";

let problems: string[] = [];

test.beforeEach(async ({ page }) => {
  problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  await resetSettings(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

// Any runtime error or CSP violation fails the test that caused it.
test.afterEach(() => {
  expect(problems, "console/page errors").toEqual([]);
});

test("quick capture with C lands in the Inbox", async ({ page }) => {
  const text = uniq("Ideia E2E");
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("c");
  await page.getByRole("textbox", { name: "Conteúdo da captura" }).fill(text);
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("Capturado na Inbox")).toBeVisible();

  await page.keyboard.press("g");
  await page.keyboard.press("i");
  await expect(page).toHaveURL(/\/inbox$/);
  const row = page.getByTestId("inbox-item").filter({ hasText: text });
  await expect(row).toBeVisible();

  await row.hover();
  await row.getByRole("button", { name: "Marcar como processado" }).click();
  await expect(row).toBeHidden();
  await page.getByRole("tab", { name: "Processados" }).click();
  await expect(page.getByTestId("inbox-item").filter({ hasText: text })).toBeVisible();
});

test("single-key shortcuts are ignored while typing", async ({ page }) => {
  await page.getByRole("textbox", { name: "Captura rápida" }).pressSequentially("cg[");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("aside")).toHaveAttribute("data-collapsed", "false");
});

test("command palette navigates with accent-insensitive search", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Ir para… ou digite um comando").fill("financas");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/finance$/);
  await expect(page.getByText("Ainda não implementado")).toBeVisible();
});

test("sidebar collapses with [ right after using the palette, and persists", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Ir para… ou digite um comando").fill("tarefas");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/tasks$/);
  await page.keyboard.press("["); // regression: palette input kept focus during exit animation
  await expect(page.locator("aside")).toHaveAttribute("data-collapsed", "true");
  await page.reload();
  await expect(page.locator("aside")).toHaveAttribute("data-collapsed", "true");
});

test("theme switches from the palette and persists across reloads", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Ir para… ou digite um comando").fill("escuro");
  await expect(page.locator("[cmdk-item][data-selected=true]")).toHaveText(/Tema escuro/);
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("settings page runs the integrity check", async ({ page }) => {
  await page.keyboard.press("g");
  await page.keyboard.press("s");
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("button", { name: /Verificar integridade/ }).click();
  await expect(page.getByTestId("integrity-result")).toHaveText(/Integridade OK/);
  await expect(page.getByRole("cell", { name: "system.integrity_check" }).first()).toBeVisible();
});

test("shortcut help, 404 and deep-link SPA fallback", async ({ page }) => {
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Shift+?");
  await expect(page.getByRole("dialog", { name: "Atalhos de teclado" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/rota/inexistente");
  await expect(page.getByText("Página não encontrada")).toBeVisible();
  await page.goto("/journal/qualquer-coisa"); // module still a placeholder (Phase 5)
  await expect(page.getByRole("heading", { name: "Diário" })).toBeVisible();
  await page.goto("/notes/nao-e-um-uuid"); // invalid id: "not found" without hitting the API
  await expect(page.getByText("Nota não encontrada")).toBeVisible();
});

test("responses carry the CSP header", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.headers()["content-security-policy"]).toContain("default-src 'self'");
});
