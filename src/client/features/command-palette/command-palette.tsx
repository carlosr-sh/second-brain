import { CheckSquareIcon, KeyboardIcon, LandmarkIcon, MonitorIcon, MoonIcon, NotebookPenIcon, PanelLeftIcon, PlusIcon, SunIcon, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { SearchEntity, SearchResult } from "@shared/knowledge";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { ALL_MODULES } from "@/app/navigation";
import { useUiState } from "@/app/ui-state";
import { HighlightText } from "@/features/knowledge/highlight-text";
import { useSearch } from "@/features/knowledge/queries";
import { KeysHint } from "@/features/shortcuts/keys-hint";
import { useTaskEditor } from "@/features/tasks/task-editor-context";
import { useTheme } from "@/features/theme/theme-provider";
import { commandFilter } from "@/lib/search-filter";

interface StaticItem {
  group: "Ações" | "Navegar" | "Tema";
  value: string;
  label: string;
  icon: LucideIcon;
  keywords: string[];
  keys?: string;
  run: () => void;
}

const ENTITY_LABEL: Record<SearchEntity, string> = {
  note: "Nota", task: "Tarefa", project: "Projeto", area: "Área", goal: "Meta", resource: "Recurso", bookmark: "Link", book: "Livro",
  journal: "Diário", contact: "Contato", transaction: "Lançamento",
};
const ENTITY_MODULE: Record<SearchEntity, string> = {
  note: "notes", task: "tasks", project: "projects", area: "areas", goal: "goals", resource: "resources", bookmark: "bookmarks",
  book: "bookshelf", journal: "journal", contact: "contacts", transaction: "finance",
};
const stripMarks = (s: string) => s.replace(/[\u0002\u0003]/g, "");

/**
 * Command palette (⌘K): actions, navigation and full-text content search.
 * Static items and their matching logic come from the same data, so selection
 * priority is deterministic: a matching static item wins; otherwise the first
 * search result is selected.
 */
export function CommandPalette({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { paletteOpen, setPaletteOpen, setCaptureOpen, setShortcutsOpen } = useUiState();
  const { setPreference } = useTheme();
  const { openNew, openTask } = useTaskEditor();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const search = useSearch(query);
  const results = query.trim().length >= 2 ? (search.data ?? []) : [];

  const items = useMemo<StaticItem[]>(
    () => [
      { group: "Ações", value: "Captura rápida", label: "Captura rápida", icon: PlusIcon, keywords: ["nova", "inbox", "adicionar", "capture"], keys: "c", run: () => setCaptureOpen(true) },
      { group: "Ações", value: "Nova tarefa", label: "Nova tarefa", icon: CheckSquareIcon, keywords: ["criar", "task", "todo", "adicionar"], keys: "n", run: () => openNew() },
      { group: "Ações", value: "Novo lançamento financeiro", label: "Novo lançamento", icon: LandmarkIcon, keywords: ["despesa", "receita", "gasto", "dinheiro", "transacao"], run: () => navigate("/finance?tab=transactions&new=1") },
      { group: "Ações", value: "Escrever no diário de hoje", label: "Escrever no diário de hoje", icon: NotebookPenIcon, keywords: ["journal", "registro", "dia"], run: () => navigate("/journal") },
      { group: "Ações", value: "Recolher expandir barra lateral", label: "Recolher / expandir barra lateral", icon: PanelLeftIcon, keywords: ["sidebar", "menu", "barra"], keys: "[", run: onToggleSidebar },
      { group: "Ações", value: "Atalhos de teclado", label: "Atalhos de teclado", icon: KeyboardIcon, keywords: ["teclado", "keyboard", "ajuda"], keys: "?", run: () => setShortcutsOpen(true) },
      ...ALL_MODULES.map((m): StaticItem => ({ group: "Navegar", value: `Ir para ${m.label}`, label: m.label, icon: m.icon, keywords: [m.description], keys: m.shortcut, run: () => navigate(m.path) })),
      { group: "Tema", value: "Tema claro", label: "Tema claro", icon: SunIcon, keywords: ["theme", "light"], run: () => setPreference("light") },
      { group: "Tema", value: "Tema escuro", label: "Tema escuro", icon: MoonIcon, keywords: ["theme", "dark"], run: () => setPreference("dark") },
      { group: "Tema", value: "Tema do sistema", label: "Tema do sistema", icon: MonitorIcon, keywords: ["theme", "system", "automático"], run: () => setPreference("system") },
    ],
    [navigate, onToggleSidebar, openNew, setCaptureOpen, setPreference, setShortcutsOpen],
  );

  const resultValue = (r: SearchResult) => `search:${r.entity}:${r.id}`;
  const staticMatch = query.trim() !== "" && items.some((i) => commandFilter(i.value, query, i.keywords) > 0);
  const first = results[0];
  useEffect(() => {
    // No static item matches → the first content result becomes the selection.
    if (first && !staticMatch && !selected.startsWith("search:")) setSelected(resultValue(first));
  }, [first?.id, staticMatch]);

  const openResult = (r: SearchResult) => {
    const routes: Record<SearchEntity, string | null> = {
      note: `/notes/${r.id}`, task: null, project: `/projects/${r.id}`, area: `/areas/${r.id}`, goal: "/goals", resource: `/resources/${r.id}`,
      bookmark: "/bookmarks", book: "/bookshelf", journal: `/journal/${stripMarks(r.title).slice(0, 10)}`, // journal titles start with the date
      contact: `/contacts/${r.id}`, transaction: `/finance?tab=transactions&tx=${r.id}`,
    };
    const to = routes[r.entity];
    if (to) navigate(to);
    else openTask(r.id);
  };
  const run = (fn: () => void) => () => {
    setPaletteOpen(false);
    fn();
  };
  const close = (o: boolean) => {
    setPaletteOpen(o);
    if (!o) {
      setQuery("");
      setSelected("");
    }
  };

  return (
    <CommandDialog open={paletteOpen} onOpenChange={close} title="Buscar e comandos" description="Navegue, execute uma ação ou busque no conteúdo">
      <Command loop filter={commandFilter} value={selected} onValueChange={(v) => setSelected(v || (first && !staticMatch ? resultValue(first) : ""))}>
        <CommandInput placeholder="Buscar em tudo, ir para… ou digite um comando" value={query} onValueChange={setQuery} />
        <CommandList>
          {/* cmdk's empty state ignores forceMount items: only show it when search found nothing too. */}
          {results.length === 0 && <CommandEmpty>{query.trim().length >= 2 && search.isFetching ? "Buscando…" : "Nada encontrado."}</CommandEmpty>}
          {(["Ações", "Navegar", "Tema"] as const).map((group) => (
            <CommandGroup key={group} heading={group}>
              {items.filter((i) => i.group === group).map((i) => (
                <CommandItem key={i.value} value={i.value} keywords={i.keywords} onSelect={run(i.run)}>
                  <i.icon /> {i.label}
                  {i.keys && <CommandShortcut><KeysHint keys={i.keys} /></CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          {results.length > 0 && (
            <CommandGroup heading="Conteúdo" forceMount>
              {results.map((r) => {
                const Icon = ALL_MODULES.find((m) => m.id === ENTITY_MODULE[r.entity])?.icon;
                return (
                  <CommandItem key={resultValue(r)} value={resultValue(r)} forceMount onSelect={run(() => openResult(r))} data-testid="search-result">
                    {Icon && <Icon />}
                    <div className="min-w-0 flex-1">
                      <HighlightText text={r.title || "(sem título)"} className="block truncate" />
                      {r.snippet && <HighlightText text={r.snippet} className="block truncate text-xs text-muted-foreground" />}
                    </div>
                    <span className="text-xs text-muted-foreground">{ENTITY_LABEL[r.entity]}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
