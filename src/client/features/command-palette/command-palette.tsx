import { CheckSquareIcon, KeyboardIcon, MonitorIcon, MoonIcon, PanelLeftIcon, PlusIcon, SunIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { SearchEntity, SearchResult } from "@shared/knowledge";
import { HighlightText } from "@/features/knowledge/highlight-text";
import { useSearch } from "@/features/knowledge/queries";
import { ALL_MODULES as MODULES } from "@/app/navigation";
import {
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { ALL_MODULES } from "@/app/navigation";
import { useUiState } from "@/app/ui-state";
import { KeysHint } from "@/features/shortcuts/keys-hint";
import { useTheme } from "@/features/theme/theme-provider";
import { useTaskEditor } from "@/features/tasks/task-editor-context";
import { commandFilter } from "@/lib/search-filter";

/**
 * Command palette (⌘K). Phase 2: navigation + actions.
 * Phase 4 adds full-text search results (notes, tasks, ...) as a new group.
 */
export function CommandPalette({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { paletteOpen, setPaletteOpen, setCaptureOpen, setShortcutsOpen } = useUiState();
  const { setPreference } = useTheme();
  const { openNew, openTask } = useTaskEditor();
  const [query, setQuery] = useState("");
  const search = useSearch(query);
  const results = query.trim().length >= 2 ? (search.data ?? []) : [];
  const resultValue = (r: SearchResult) => `search:${r.entity}:${r.id}`;

  // Controlled selection: cmdk only auto-selects items that passed ITS filter, and
  // search results arrive asynchronously (forceMount) — select the first one ourselves.
  const [selected, setSelected] = useState("");
  const first = results[0];
  useEffect(() => {
    if (first && !selected.startsWith("search:")) setSelected(resultValue(first));
  }, [first?.id]);

  const ENTITY_LABEL: Record<SearchEntity, string> = {
    note: "Nota", task: "Tarefa", project: "Projeto", area: "Área", goal: "Meta", resource: "Recurso", bookmark: "Link", book: "Livro",
    journal: "Diário", contact: "Contato", transaction: "Lançamento",
  };
  const ENTITY_ICON = (e: SearchEntity) => MODULES.find((m) => m.id === ({ note: "notes", task: "tasks", project: "projects", area: "areas", goal: "goals", resource: "resources", bookmark: "bookmarks", book: "bookshelf", journal: "journal", contact: "contacts", transaction: "finance" } as const)[e])?.icon;
  const openResult = (r: SearchResult) => {
    const routes: Record<SearchEntity, string | null> = {
      note: `/notes/${r.id}`, task: null, project: `/projects/${r.id}`, area: `/areas/${r.id}`, goal: "/goals",
      resource: `/resources/${r.id}`, bookmark: "/bookmarks", book: "/bookshelf",
      // Journal entries are indexed with the date first in the title.
      journal: `/journal/${r.title.replace(/[\u0002\u0003]/g, "").slice(0, 10)}`,
      contact: `/contacts/${r.id}`, transaction: `/finance?tab=transactions&tx=${r.id}`,
    };
    const to = routes[r.entity];
    if (to) navigate(to);
    else openTask(r.id);
  };
  const navigate = useNavigate();

  const run = (fn: () => void) => () => {
    setPaletteOpen(false);
    fn();
  };

  return (
    <CommandDialog open={paletteOpen} onOpenChange={(o) => { setPaletteOpen(o); if (!o) { setQuery(""); setSelected(""); } }} title="Buscar e comandos" description="Navegue ou execute uma ação">
      <Command
        loop
        filter={commandFilter}
        value={selected}
        // cmdk resets the selection to "" when no STATIC item matches the query,
        // even though search results are shown: fall back to the first result.
        onValueChange={(v) => setSelected(v || (first ? resultValue(first) : ""))}
      >
        <CommandInput placeholder="Buscar em tudo, ir para… ou digite um comando" value={query} onValueChange={setQuery} />
        <CommandList>
          {/* cmdk's empty state ignores forceMount items: only show it when search found nothing too. */}
          {results.length === 0 && <CommandEmpty>{query.trim().length >= 2 && search.isFetching ? "Buscando…" : "Nada encontrado."}</CommandEmpty>}
          {results.length > 0 && (
            <CommandGroup heading="Conteúdo" forceMount>
              {results.map((r) => {
                const Icon = ENTITY_ICON(r.entity);
                return (
                  <CommandItem key={`${r.entity}:${r.id}`} value={resultValue(r)} forceMount onSelect={run(() => openResult(r))} data-testid="search-result">
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
          <CommandGroup heading="Ações">
            <CommandItem value="Captura rápida" onSelect={run(() => setCaptureOpen(true))} keywords={["nova", "inbox", "adicionar", "capture"]}>
              <PlusIcon /> Captura rápida
              <CommandShortcut><KeysHint keys="c" /></CommandShortcut>
            </CommandItem>
            <CommandItem value="Nova tarefa" onSelect={run(() => openNew())} keywords={["criar", "task", "todo", "adicionar"]}>
              <CheckSquareIcon /> Nova tarefa
              <CommandShortcut><KeysHint keys="n" /></CommandShortcut>
            </CommandItem>
            <CommandItem value="Recolher expandir barra lateral" onSelect={run(onToggleSidebar)} keywords={["sidebar", "menu", "barra"]}>
              <PanelLeftIcon /> Recolher / expandir barra lateral
              <CommandShortcut><KeysHint keys="[" /></CommandShortcut>
            </CommandItem>
            <CommandItem value="Atalhos de teclado" onSelect={run(() => setShortcutsOpen(true))} keywords={["teclado", "keyboard", "ajuda"]}>
              <KeyboardIcon /> Atalhos de teclado
              <CommandShortcut><KeysHint keys="?" /></CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Navegar">
            {ALL_MODULES.map((m) => (
              <CommandItem key={m.id} value={`Ir para ${m.label}`} keywords={[m.description]} onSelect={run(() => navigate(m.path))}>
                <m.icon /> {m.label}
                {m.shortcut && <CommandShortcut><KeysHint keys={m.shortcut} /></CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Tema">
            <CommandItem value="Tema claro" onSelect={run(() => setPreference("light"))} keywords={["theme", "light"]}><SunIcon /> Tema claro</CommandItem>
            <CommandItem value="Tema escuro" onSelect={run(() => setPreference("dark"))} keywords={["theme", "dark"]}><MoonIcon /> Tema escuro</CommandItem>
            <CommandItem value="Tema do sistema" onSelect={run(() => setPreference("system"))} keywords={["theme", "system", "automático"]}><MonitorIcon /> Tema do sistema</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
