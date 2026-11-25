import { PanelLeftCloseIcon, PanelLeftOpenIcon, PlusIcon, SearchIcon, SettingsIcon } from "lucide-react";
import { NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Hint } from "@/components/ui/tooltip";
import type { ReactNode } from "react";
import { useUiState } from "@/app/ui-state";
import { useMe } from "@/features/system/hooks";
import { KeysHint } from "@/features/shortcuts/keys-hint";
import { cn, isMac } from "@/lib/utils";
import { BrandMark } from "./brand";
import { SidebarNav } from "./sidebar-nav";
import { ThemeMenu } from "./theme-menu";

/** Tooltips only help when the sidebar is collapsed (labels hidden). */
function MaybeHint({ show, label, children }: { show: boolean; label: ReactNode; children: ReactNode }) {
  return show ? <Hint side="right" label={label}>{children}</Hint> : children;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
  /** Mobile drawer mode: always expanded, closes on navigation. */
  onNavigate?: () => void;
  className?: string;
}

export function SidebarContent({ collapsed, onToggle, onNavigate }: SidebarProps) {
  const { setPaletteOpen, setCaptureOpen } = useUiState();
  const me = useMe();

  const actionClass = cn(
    "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13.5px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
    collapsed && "justify-center px-0",
  );

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 shrink-0 items-center gap-2 px-3", collapsed && "justify-center px-0")}>
        {!collapsed && (
          <>
            <BrandMark />
            <span className="truncate text-sm font-semibold tracking-tight">Second Brain</span>
          </>
        )}
        {onToggle && (
          <Hint side="right" label={<span className="flex items-center gap-2">{collapsed ? "Expandir" : "Recolher"} <KeysHint keys="[" /></span>}>
            <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"} className={cn(!collapsed && "ml-auto", "text-muted-foreground")}>
              {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
            </Button>
          </Hint>
        )}
      </div>

      <div className={cn("flex flex-col gap-0.5 px-2 pb-3", collapsed && "items-center")}>
        <MaybeHint show={collapsed} label="Buscar e comandos">
          <button type="button" className={actionClass} onClick={() => setPaletteOpen(true)} aria-label="Buscar e comandos">
            <SearchIcon className="size-4 text-muted-foreground" />
            {!collapsed && (
              <>
                <span>Buscar</span>
                <span className="ml-auto flex gap-0.5 pointer-coarse:hidden">
                  <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
                  <Kbd>K</Kbd>
                </span>
              </>
            )}
          </button>
        </MaybeHint>
        <MaybeHint show={collapsed} label="Captura rápida">
          <button type="button" className={actionClass} onClick={() => setCaptureOpen(true)} aria-label="Captura rápida">
            <PlusIcon className="size-4 text-muted-foreground" />
            {!collapsed && (
              <>
                <span>Capturar</span>
                <Kbd className="ml-auto pointer-coarse:hidden">C</Kbd>
              </>
            )}
          </button>
        </MaybeHint>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto px-2 pb-4", collapsed && "px-2")}>
        <SidebarNav collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <div className={cn("flex shrink-0 items-center gap-1 border-t border-sidebar-border p-2", collapsed && "flex-col")}>
        <Hint side="right" label="Configurações">
          <NavLink
            to="/settings"
            onClick={onNavigate}
            aria-label="Configurações"
            className={({ isActive }) =>
              cn(
                "flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-accent text-brand",
              )
            }
          >
            <SettingsIcon className="size-4" />
          </NavLink>
        </Hint>
        <ThemeMenu />
        {!collapsed && me.data && (
          <span className="ml-auto truncate text-xs text-muted-foreground" title={me.data.email}>
            {me.data.email}
          </span>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ collapsed, onToggle, className }: SidebarProps) {
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "hidden h-full shrink-0 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out md:block",
        collapsed ? "w-14" : "w-60",
        className,
      )}
    >
      <SidebarContent collapsed={collapsed} onToggle={onToggle} />
    </aside>
  );
}
