import { expect, test, type Page } from "@playwright/test";
import { resetSettings, uniq } from "./helpers";

let problems: string[] = [];
test.beforeEach(async ({ page }) => {
  problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  await resetSettings(page);
});
test.afterEach(() => expect(problems, "console/page errors").toEqual([]));

async function createAccount(page: Page, name: string, opening: string, type = "checking") {
  await page.goto("/finance?tab=accounts");
  await page.getByLabel("Nome da conta").fill(name);
  await page.getByLabel("Tipo de conta").selectOption(type);
  await page.locator("#opening").fill(opening);
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page.getByTestId("account-card").filter({ hasText: name })).toBeVisible();
}
const balance = (page: Page, name: string) => page.getByTestId("account-card").filter({ hasText: name }).getByTestId("account-balance");

test("finance: expense + income + transfer keep exact balances; overview renders charts", async ({ page }) => {
  const a = uniq("Corrente");
  const b = uniq("Cartão");
  await createAccount(page, a, "1.000,00");
  await createAccount(page, b, "-450,00", "credit_card");

  await page.goto("/finance?tab=transactions");
  for (const [kind, amount, desc] of [["Receita", "2.500,00", uniq("Freela")], ["Despesa", "19,90", uniq("Streaming")]] as const) {
    await page.getByRole("button", { name: "Lançamento" }).click();
    const d = page.getByRole("dialog");
    await d.getByRole("tab", { name: kind }).click();
    await d.getByLabel("Valor").fill(amount);
    await d.getByLabel("Descrição").fill(desc);
    await d.getByLabel("Conta").selectOption({ label: a });
    await d.getByRole("button", { name: "Lançar" }).click();
    await expect(d).toBeHidden();
  }
  await page.getByRole("button", { name: "Transferir" }).click();
  const t = page.getByRole("dialog");
  await t.getByLabel("De", { exact: true }).selectOption({ label: a });
  await t.getByLabel("Para", { exact: true }).selectOption({ label: b });
  await t.getByLabel("Valor", { exact: true }).fill("450");
  await t.getByRole("button", { name: "Transferir" }).click();
  await expect(t).toBeHidden();

  await page.goto("/finance?tab=accounts");
  await expect(balance(page, a)).toHaveText(/3\.030,10/); // 1000 + 2500 − 19,90 − 450
  await expect(balance(page, b)).toHaveText(/0,00/);

  await page.goto("/finance");
  await expect(page.getByTestId("chart-income-expense").locator(".recharts-bar-rectangle").first()).toBeVisible();
  await page.getByRole("button", { name: "Ver tabela" }).first().click();
  await expect(page.getByRole("table").first()).toBeVisible();
});

test("finance: invalid amount is rejected client-side", async ({ page }) => {
  await createAccount(page, uniq("Conta"), "0");
  await page.goto("/finance?tab=transactions");
  await page.getByRole("button", { name: "Lançamento" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Valor").fill("12,345");
  await d.getByLabel("Descrição").fill("x");
  await d.getByRole("button", { name: "Lançar" }).click();
  await expect(d.getByRole("alert")).toContainText("Valor inválido");
});

test("habits: check-in today and see the streak", async ({ page }) => {
  const name = uniq("Meditar");
  await page.goto("/habits");
  await page.getByLabel("Novo hábito").fill(name);
  await page.getByRole("button", { name: "Criar" }).click();
  const card = page.getByTestId("habit-card").filter({ hasText: name });
  await card.getByTestId("habit-check").click();
  await expect(card.getByTestId("habit-streak")).toHaveText(/1 dia seguido/);
  await card.getByTestId("habit-check").click(); // undo
  await expect(card.getByTestId("habit-streak")).toHaveText(/0 dias seguidos/);
});

test("journal: write today's entry, autosave, find it with the palette", async ({ page }) => {
  const word = uniq("gratidão").replace(" ", "");
  await page.goto("/journal");
  await expect(page).toHaveURL(/\/journal\/\d{4}-\d{2}-\d{2}$/);
  await page.getByRole("radio", { name: "Humor: Ótimo" }).click();
  await page.getByRole("textbox", { name: "Conteúdo da nota" }).click();
  await page.keyboard.type(`Registro com ${word}`);
  await expect(page.getByTestId("save-status")).toHaveText("Salvo", { timeout: 10_000 });
  await page.reload();
  await expect(page.getByText(`Registro com ${word}`)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Humor: Ótimo" })).toHaveAttribute("aria-checked", "true");
  const url = page.url();
  await page.goto("/");
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type(word.normalize("NFD").replace(/\p{Diacritic}/gu, ""));
  await expect(page.getByTestId("search-result").first()).toContainText("Diário");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(url);
});

test("contacts: cadence makes a contact due; logging an interaction clears it", async ({ page }) => {
  const name = uniq("Bruno");
  await page.goto("/contacts");
  await page.getByLabel("Nome do novo contato").fill(name);
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page).toHaveURL(/\/contacts\/.+/);
  await page.getByLabel("Falar a cada (dias)").fill("15");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.locator("header").getByText("Para contatar")).toBeVisible();
  await page.getByLabel("Resumo da interação").fill("Almoço");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByTestId("interactions")).toContainText("Almoço");
  await expect(page.locator("header").getByText("Para contatar")).toHaveCount(0);
});
