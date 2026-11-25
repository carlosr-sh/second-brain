import {
  ArchiveIcon,
  BookMarkedIcon,
  BookmarkIcon,
  CalendarCheck2Icon,
  FolderKanbanIcon,
  HashIcon,
  HouseIcon,
  InboxIcon,
  LandmarkIcon,
  LayersIcon,
  LibraryBigIcon,
  ListChecksIcon,
  NotebookPenIcon,
  NotebookTabsIcon,
  SettingsIcon,
  StickyNoteIcon,
  TargetIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";

export interface NavModule {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Sequence shortcut, e.g. "g p". */
  shortcut?: string;
  /** Roadmap phase in which the module becomes functional. */
  phase: number;
  description: string;
}

export interface NavGroup {
  id: string;
  label: string | null;
  modules: NavModule[];
}

/**
 * Single registry of every module. The sidebar, the command palette and the
 * "G then X" shortcuts are all generated from it.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "home",
    label: null,
    modules: [
      { id: "dashboard", label: "Início", path: "/", icon: HouseIcon, shortcut: "g h", phase: 2, description: "Visão geral do dia" },
      { id: "inbox", label: "Inbox", path: "/inbox", icon: InboxIcon, shortcut: "g i", phase: 2, description: "Capturas aguardando organização" },
    ],
  },
  {
    id: "para",
    label: "PARA",
    modules: [
      { id: "projects", label: "Projetos", path: "/projects", icon: FolderKanbanIcon, shortcut: "g p", phase: 3, description: "Esforços com objetivo e prazo" },
      { id: "areas", label: "Áreas", path: "/areas", icon: LayersIcon, shortcut: "g a", phase: 3, description: "Responsabilidades contínuas" },
      { id: "resources", label: "Recursos", path: "/resources", icon: LibraryBigIcon, shortcut: "g r", phase: 4, description: "Temas de interesse e referência" },
      { id: "archive", label: "Arquivo", path: "/archive", icon: ArchiveIcon, shortcut: "g x", phase: 3, description: "Itens inativos, preservados e pesquisáveis" },
    ],
  },
  {
    id: "action",
    label: "Ação",
    modules: [
      { id: "tasks", label: "Tarefas", path: "/tasks", icon: ListChecksIcon, shortcut: "g t", phase: 3, description: "Próximas ações" },
      { id: "goals", label: "Metas", path: "/goals", icon: TargetIcon, shortcut: "g m", phase: 3, description: "Resultados desejados" },
      { id: "habits", label: "Hábitos", path: "/habits", icon: CalendarCheck2Icon, shortcut: "g b", phase: 5, description: "Rotinas e histórico" },
    ],
  },
  {
    id: "knowledge",
    label: "Conhecimento",
    modules: [
      { id: "notes", label: "Notas", path: "/notes", icon: StickyNoteIcon, shortcut: "g n", phase: 4, description: "Notas, backlinks e ideias" },
      { id: "notebooks", label: "Cadernos", path: "/notebooks", icon: NotebookTabsIcon, phase: 4, description: "Coleções de notas" },
      { id: "tags", label: "Tags", path: "/tags", icon: HashIcon, phase: 4, description: "Etiquetas transversais" },
      { id: "bookmarks", label: "Links", path: "/bookmarks", icon: BookmarkIcon, shortcut: "g l", phase: 4, description: "Bookmarks e leitura posterior" },
      { id: "bookshelf", label: "Estante", path: "/bookshelf", icon: BookMarkedIcon, phase: 4, description: "Livros lidos e a ler" },
    ],
  },
  {
    id: "life",
    label: "Vida",
    modules: [
      { id: "journal", label: "Diário", path: "/journal", icon: NotebookPenIcon, shortcut: "g j", phase: 5, description: "Registro diário" },
      { id: "finance", label: "Finanças", path: "/finance", icon: LandmarkIcon, shortcut: "g f", phase: 5, description: "Contas, transações e categorias" },
      { id: "contacts", label: "Contatos", path: "/contacts", icon: UsersRoundIcon, shortcut: "g c", phase: 5, description: "Pessoas e interações" },
    ],
  },
];

export const SETTINGS_MODULE: NavModule = {
  id: "settings",
  label: "Configurações",
  path: "/settings",
  icon: SettingsIcon,
  shortcut: "g s",
  phase: 2,
  description: "Aparência, sistema e auditoria",
};

export const ALL_MODULES: NavModule[] = [...NAV_GROUPS.flatMap((g) => g.modules), SETTINGS_MODULE];

export function findModuleByPath(pathname: string): NavModule | undefined {
  if (pathname === "/") return ALL_MODULES[0];
  return ALL_MODULES.find((m) => m.path !== "/" && (pathname === m.path || pathname.startsWith(`${m.path}/`)));
}
