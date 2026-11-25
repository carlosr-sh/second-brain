import { useMemo } from "react";
import { Outlet, useNavigate } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { useUiState } from "@/app/ui-state";
import { CommandPalette } from "@/features/command-palette/command-palette";
import { QuickCaptureDialog } from "@/features/inbox/quick-capture-dialog";
import type { ShortcutBinding } from "@/features/shortcuts/engine";
import { NAVIGATION_SHORTCUTS } from "@/features/shortcuts/global-shortcuts";
import { ShortcutsDialog } from "@/features/shortcuts/shortcuts-dialog";
import { useShortcuts } from "@/features/shortcuts/use-shortcuts";
import { MobileTopbar } from "./mobile-topbar";
import { Sidebar } from "./sidebar";
import { useSidebarCollapsed } from "./use-sidebar";

export function AppShell() {
  const [collapsed, toggleSidebar] = useSidebarCollapsed();
  const { setPaletteOpen, setCaptureOpen, setShortcutsOpen, paletteOpen, captureOpen } = useUiState();
  const navigate = useNavigate();
  const dialogOpen = paletteOpen || captureOpen;

  const bindings = useMemo<ShortcutBinding[]>(
    () => [
      { id: "palette", keys: "mod+k", allowInInputs: true, run: () => setPaletteOpen((o) => !o) },
      ...(dialogOpen
        ? []
        : [
            { id: "capture", keys: "c", run: () => setCaptureOpen(true) },
            { id: "sidebar", keys: "[", run: toggleSidebar },
            { id: "help", keys: "?", run: () => setShortcutsOpen(true) },
            ...NAVIGATION_SHORTCUTS.map((s) => ({ id: `nav:${s.path}`, keys: s.keys, run: () => navigate(s.path) })),
          ]),
    ],
    [dialogOpen, navigate, setCaptureOpen, setPaletteOpen, setShortcutsOpen, toggleSidebar],
  );
  useShortcuts(bindings);

  return (
    <div className="flex h-full">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow">
        Pular para o conteúdo
      </a>
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopbar />
        <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
          <Outlet />
        </main>
      </div>
      <CommandPalette onToggleSidebar={toggleSidebar} />
      <QuickCaptureDialog />
      <ShortcutsDialog />
      <Toaster />
    </div>
  );
}
