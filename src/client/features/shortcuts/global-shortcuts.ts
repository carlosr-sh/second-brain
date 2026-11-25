import { ALL_MODULES } from "@/app/navigation";

/** Documented global shortcuts (also rendered in the help dialog). */
export const GLOBAL_SHORTCUTS = [
  { keys: "mod+k", label: "Buscar e comandos" },
  { keys: "c", label: "Captura rápida" },
  { keys: "n", label: "Nova tarefa" },
  { keys: "[", label: "Recolher / expandir barra lateral" },
  { keys: "?", label: "Mostrar atalhos" },
  { keys: "mod+enter", label: "Salvar (em formulários)" },
] as const;

export const NAVIGATION_SHORTCUTS = ALL_MODULES.filter((m) => m.shortcut).map((m) => ({
  keys: m.shortcut as string,
  label: `Ir para ${m.label}`,
  path: m.path,
}));
