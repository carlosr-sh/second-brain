import { NavLink } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import { NAV_GROUPS, type NavModule } from "@/app/navigation";
import { useInboxCount } from "@/features/inbox/hooks";
import { KeysHint } from "@/features/shortcuts/keys-hint";
import { cn } from "@/lib/utils";

function NavItem({ module, collapsed, onNavigate }: { module: NavModule; collapsed: boolean; onNavigate?: () => void }) {
  const inboxCount = useInboxCount();
  const count = module.id === "inbox" ? (inboxCount.data ?? 0) : 0;

  const link = (
    <NavLink
      to={module.path}
      end={module.path === "/"}
      onClick={onNavigate}
      aria-label={collapsed ? module.label : undefined}
      className={({ isActive }) =>
        cn(
          "group/nav relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] text-sidebar-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
          collapsed && "justify-center px-0",
        )
      }
    >
      {({ isActive }) => (
        <>
          <module.icon className={cn("size-4 shrink-0", isActive ? "text-brand" : "text-muted-foreground group-hover/nav:text-sidebar-accent-foreground")} />
          {!collapsed && <span className="truncate">{module.label}</span>}
          {count > 0 &&
            (collapsed ? (
              <span className="absolute top-1 right-1.5 size-1.5 rounded-full bg-brand" aria-label={`${count} itens`} />
            ) : (
              <Badge variant="brand" className="ml-auto tabular-nums" data-testid="inbox-count">
                {count}
              </Badge>
            ))}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;
  return (
    <Hint
      side="right"
      label={
        <span className="flex items-center gap-2">
          {module.label}
          {module.shortcut && <KeysHint keys={module.shortcut} className="opacity-80" />}
        </span>
      }
    >
      {link}
    </Hint>
  );
}

export function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Módulos" className="flex flex-col gap-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          {group.label &&
            (collapsed ? (
              <div className="mx-auto my-1 h-px w-5 bg-sidebar-border" aria-hidden />
            ) : (
              <div className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{group.label}</div>
            ))}
          {group.modules.map((m) => (
            <NavItem key={m.id} module={m} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}
