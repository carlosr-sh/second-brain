import { MenuIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { findModuleByPath } from "@/app/navigation";
import { useUiState } from "@/app/ui-state";
import { SidebarContent } from "./sidebar";

export function MobileTopbar() {
  const { mobileNavOpen, setMobileNavOpen, setPaletteOpen, setCaptureOpen } = useUiState();
  const module = findModuleByPath(useLocation().pathname);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-1 border-b bg-background/85 px-2 backdrop-blur md:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menu">
          <MenuIcon />
        </Button>
        <span className="truncate text-sm font-medium">{module?.label ?? "Second Brain"}</span>
        <div className="ml-auto flex">
          <Button variant="ghost" size="icon" onClick={() => setPaletteOpen(true)} aria-label="Buscar">
            <SearchIcon />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCaptureOpen(true)} aria-label="Captura rápida">
            <PlusIcon />
          </Button>
        </div>
      </header>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left">
          <SheetTitle className="sr-only">Navegação</SheetTitle>
          <SheetDescription className="sr-only">Módulos do Second Brain</SheetDescription>
          <SidebarContent collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
