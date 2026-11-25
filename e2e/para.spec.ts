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

async function createProject(page: Page, name: string) {
  await page.goto("/projects");
  await page.getByRole("button", { name: "Novo projeto" }).click();
  await page.getByLabel("Nome").fill(name);
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await page.getByRole("link", { name }).click();
  await expect(page).toHaveURL(/\/projects\/.+/);
}

async function addTask(page: Page, title: string) {
  await page.getByRole("textbox", { name: "Adicionar tarefa…" }).fill(title);
  await page.keyboard.press("Enter");
  await expect(page.getByText(title)).toBeVisible();
}

test("project: tasks, completion progress and editor with subtasks", async ({ page }) => {
  const p = uniq("Projeto");
  await createProject(page, p);
  const [a, b] = [uniq("Tarefa A"), uniq("Tarefa B")];
  await addTask(page, a);
  await addTask(page, b);
  await page.getByRole("checkbox", { name: `Concluir "${b}"` }).click();
  await expect(page.getByRole("progressbar", { name: "Progresso do projeto" })).toHaveAttribute("aria-valuenow", "50");

  // Editor: subtask quick-add must NOT submit/close the editor (regression: nested forms).
  await page.getByRole("button", { name: a }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Adicionar subtarefa…" }).fill("Sub 1");
  await page.keyboard.press("Enter");
  await expect(dialog.getByText("Sub 1")).toBeVisible();
  await expect(dialog).toBeVisible();

  // Save must work from the editor (regression: optimistic cache crash on single-task query).
  await dialog.getByLabel("Prioridade").selectOption("high");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("task-row").filter({ hasText: a })).toContainText("Alta");
});

test("kanban drag & drop changes status and persists", async ({ page }) => {
  await createProject(page, uniq("Quadro"));
  const t = uniq("Arrastável");
  await addTask(page, t);
  await page.getByRole("tab", { name: "Quadro" }).click();
  const card = page.getByTestId("task-card").filter({ hasText: t });
  const target = page.getByRole("region", { name: "Fazendo" });
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width - 16, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 30, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 15 });
  await page.mouse.up();
  await expect(target.getByText(t)).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Quadro" }).click();
  await expect(page.getByRole("region", { name: "Fazendo" }).getByText(t)).toBeVisible();
});

test("recurring task spawns the next occurrence when completed", async ({ page }) => {
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Nova tarefa" }).click();
  const dialog = page.getByRole("dialog");
  const t = uniq("Recorrente");
  await dialog.getByLabel("Título").fill(t);
  await dialog.getByLabel("Vencimento").fill("2026-11-25");
  await dialog.getByLabel("Repetir").selectOption({ label: "Toda semana" });
  await dialog.getByRole("button", { name: "Criar" }).click();
  await page.goto("/tasks?view=list");
  await page.getByRole("checkbox", { name: `Concluir "${t}"` }).click();
  await expect(page.getByText(/Próxima ocorrência criada/)).toBeVisible();
  await page.goto("/tasks?view=table");
  await expect(page.getByTestId("task-table-row").filter({ hasText: t })).toHaveCount(1); // open copy only
});

test("inbox item converts into a task", async ({ page }) => {
  const text = uniq("Converter");
  await page.goto("/inbox");
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("c");
  await page.getByRole("textbox", { name: "Conteúdo da captura" }).fill(text);
  await page.keyboard.press("ControlOrMeta+Enter");
  const row = page.getByTestId("inbox-item").filter({ hasText: text });
  await row.hover();
  await row.getByRole("button", { name: "Converter em tarefa" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Criar tarefa" }).click();
  await expect(row).toHaveCount(0);
  await page.goto("/tasks?view=list");
  await expect(page.getByText(text)).toBeVisible();
});

test("archive and trash a project, then restore it", async ({ page }) => {
  const p = uniq("Arquivável");
  await createProject(page, p);
  await addTask(page, uniq("Filha"));
  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Arquivar" }).click();
  await page.goto("/archive");
  const row = page.getByTestId("archive-row").filter({ hasText: p });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Desarquivar" }).click();
  await expect(row).toHaveCount(0);

  await page.goto("/projects?view=list");
  await page.getByRole("link", { name: p }).click();
  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Mover para a lixeira" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.goto("/archive?tab=trash");
  const trashed = page.getByTestId("archive-row").filter({ hasText: p });
  await trashed.getByRole("button", { name: "Restaurar" }).click();
  await expect(trashed).toHaveCount(0);
});

test("calendar and table views render", async ({ page }) => {
  await page.goto("/tasks?view=calendar");
  await expect(page.getByRole("grid", { name: "Calendário de tarefas" })).toBeVisible();
  await page.getByRole("button", { name: "Próximo mês" }).click();
  await page.goto("/tasks?view=table");
  await expect(page.getByRole("table")).toBeVisible();
});
