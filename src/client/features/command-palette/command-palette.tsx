import { CheckSquareIcon, KeyboardIcon, MonitorIcon, MoonIcon, PanelLeftIcon, PlusIcon, SunIcon } from "lucide-react";
import { useNavigate } from "react-router";
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
  const { openNew } = useTaskEditor();
  const navigate = useNavigate();

  const run = (fn: () => void) => () => {
    setPaletteOpen(false);
    fn();
  };

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} title="Buscar e comandos" description="Navegue ou execute uma ação">
      <Command loop filter={commandFilter}>
        <CommandInput placeholder="Ir para… ou digite um comando" />
        <CommandList>
          <CommandEmpty>Nada encontrado. A busca no conteúdo chega na Fase 4.</CommandEmpty>
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
