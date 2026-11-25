import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { resetSettings, uniq } from "./helpers";

const PNG = fileURLToPath(new URL("./fixtures/pixel.png", import.meta.url));

let problems: string[] = [];
test.beforeEach(async ({ page }) => {
  problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  await resetSettings(page);
});
test.afterEach(() => expect(problems, "console/page errors").toEqual([]));

async function newNote(page: Page, title: string) {
  await page.goto("/notes");
  await page.getByRole("button", { name: "Nova", exact: true }).click();
  await expect(page).toHaveURL(/\/notes\/.+/);
  await page.getByLabel("Título da nota").fill(title);
}

test("note: [[link]] creates the target note, saves, and the target shows a backlink", async ({ page }) => {
  const title = uniq("Origem");
  const target = uniq("Destino");
  await newNote(page, title);
  await page.getByRole("textbox", { name: "Conteúdo da nota" }).click();
  await page.keyboard.type(`Ligado a [[${target}`);
  await page.getByRole("option", { name: new RegExp(`Criar nota “${target}”`) }).click();
  await expect(page.locator("a.note-link", { hasText: target })).toBeVisible();
  await expect(page.getByTestId("save-status")).toHaveText(/Salvo/, { timeout: 10_000 });

  await page.reload();
  await page.locator("a.note-link", { hasText: target }).click();
  await expect(page.getByLabel("Título da nota")).toHaveValue(target);
  await expect(page.getByTestId("backlinks")).toContainText(title);
});

test("note: image upload via toolbar persists", async ({ page }) => {
  await newNote(page, uniq("Imagem"));
  await page.getByRole("textbox", { name: "Conteúdo da nota" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Imagem" }).click();
  await (await chooser).setFiles(PNG);
  const img = page.locator(".ProseMirror img");
  await expect(img).toHaveAttribute("src", /^\/api\/files\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("save-status")).toHaveText(/Salvo/, { timeout: 10_000 });
  await page.reload();
  await expect(page.locator(".ProseMirror img")).toBeVisible();
  expect(await page.locator(".ProseMirror img").evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
});

test("global search in the palette is accent-insensitive and opens the result", async ({ page }) => {
  const word = uniq("Avaliação").replace(" ", "");
  await newNote(page, `Relatório ${word}`);
  await page.getByRole("textbox", { name: "Conteúdo da nota" }).click();
  await page.keyboard.type("conteúdo pesquisável");
  await expect(page.getByTestId("save-status")).toHaveText(/Salvo/, { timeout: 10_000 });
  const url = page.url();
  await page.goto("/");
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type(`relatorio ${word.normalize("NFD").replace(/\p{Diacritic}/gu, "")}`);
  const result = page.getByTestId("search-result").first();
  await expect(result).toContainText("Relatório");
  await expect(result.locator("mark").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(url);
});

test("tags: create from the picker and filter notes by tag", async ({ page }) => {
  const tag = uniq("tag").replace(" ", "-");
  const title = uniq("Com tag");
  await newNote(page, title);
  await page.getByRole("button", { name: "Editar tags" }).click();
  await page.getByLabel("Buscar ou criar tag").fill(tag);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-slot=badge]", { hasText: tag })).toBeVisible();
  await page.goto("/tags");
  await page.getByTestId("tag-row").filter({ has: page.locator(`input[value="${tag}"]`) }).getByRole("link").click();
  await expect(page.getByTestId("note-list-item").filter({ hasText: title })).toBeVisible();
});

test("bookmarks, bookshelf and inbox → note", async ({ page }) => {
  await page.goto("/bookmarks");
  const t = uniq("Artigo");
  await page.getByLabel("Endereço").fill("https://example.com/post");
  await page.getByLabel("Título").fill(t);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  const row = page.getByTestId("bookmark-row").filter({ hasText: t });
  await row.getByRole("button", { name: "Marcar lido" }).click();
  await expect(row).toHaveCount(0); // "Para ler" hides read items

  await page.goto("/bookshelf");
  const book = uniq("Livro");
  await page.getByRole("button", { name: "Livro", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Título").fill(book);
  await page.getByRole("dialog").getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByTestId("book-card").filter({ hasText: book })).toBeVisible();

  const idea = uniq("Ideia");
  await page.goto("/inbox");
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("c");
  await page.getByRole("textbox", { name: "Conteúdo da captura" }).fill(`${idea}\ncorpo da ideia`);
  await page.keyboard.press("ControlOrMeta+Enter");
  const item = page.getByTestId("inbox-item").filter({ hasText: idea });
  await item.hover();
  await item.getByRole("button", { name: "Converter em nota" }).click();
  await expect(page.getByLabel("Título da nota")).toHaveValue(idea);
});
