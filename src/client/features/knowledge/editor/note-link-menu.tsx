import { FilePlusIcon, StickyNoteIcon } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";

export interface NoteLinkItem {
  id: string;
  label: string;
  create?: boolean;
}

export interface NoteLinkMenuHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

/** Suggestion popup for [[note links]] (keyboard: ↑ ↓ Enter, Esc closes). */
export const NoteLinkMenu = forwardRef<NoteLinkMenuHandle, { items: NoteLinkItem[]; command: (item: NoteLinkItem) => void }>(
  function NoteLinkMenu({ items, command }, ref) {
    const [index, setIndex] = useState(0);
    useEffect(() => setIndex(0), [items]);
    useImperativeHandle(ref, () => ({
      onKeyDown: (e) => {
        if (e.key === "ArrowDown") { setIndex((i) => (i + 1) % Math.max(items.length, 1)); return true; }
        if (e.key === "ArrowUp") { setIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1)); return true; }
        if (e.key === "Enter" || e.key === "Tab") { const item = items[index]; if (item) command(item); return !!item; }
        return false;
      },
    }));
    return (
      <div role="listbox" aria-label="Vincular nota" className="w-72 overflow-hidden rounded-lg border bg-popover p-1 text-sm shadow-lg" data-testid="note-link-menu">
        {items.length === 0 && <div className="px-2 py-1.5 text-muted-foreground">Digite para buscar notas…</div>}
        {items.map((item, i) => (
          <button
            key={item.create ? "__create" : item.id}
            type="button"
            role="option"
            aria-selected={i === index}
            onMouseDown={(e) => { e.preventDefault(); command(item); }}
            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left", i === index && "bg-accent")}
          >
            {item.create ? <FilePlusIcon className="size-4 text-brand" /> : <StickyNoteIcon className="size-4 text-muted-foreground" />}
            <span className="truncate">{item.create ? <>Criar nota “{item.label}”</> : item.label || "(sem título)"}</span>
          </button>
        ))}
      </div>
    );
  },
);
