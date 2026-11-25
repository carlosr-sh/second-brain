import { HashIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Taggable } from "@shared/knowledge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/api";
import { useCreateTag, useSetTags, useTags } from "./queries";

/** Shows an entity's tags and lets you toggle/create tags (replace-set semantics). */
export function TagPicker({ entity, id, tagIds }: { entity: Taggable; id: string; tagIds: string[] }) {
  const tags = useTags();
  const setTags = useSetTags();
  const createTag = useCreateTag();
  const [filter, setFilter] = useState("");
  const all = tags.data ?? [];
  const selected = all.filter((t) => tagIds.includes(t.id));
  const visible = all.filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const exact = all.some((t) => t.name.toLowerCase() === filter.trim().toLowerCase());
  const save = (ids: string[]) => setTags.mutate({ entity, id, tagIds: ids }, { onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro") });
  const toggle = (tagId: string) => save(tagIds.includes(tagId) ? tagIds.filter((x) => x !== tagId) : [...tagIds, tagId]);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {selected.map((t) => <Badge key={t.id} variant="brand"><HashIcon />{t.name}</Badge>)}
      <DropdownMenu onOpenChange={(o) => !o && setFilter("")}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" aria-label="Editar tags"><PlusIcon /> Tag</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Tags</DropdownMenuLabel>
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation(); // keep typing inside the menu (Radix typeahead)
              if (e.key === "Enter" && filter.trim() && !exact) {
                createTag.mutate({ name: filter.trim() }, { onSuccess: (t) => { save([...tagIds, t.id]); setFilter(""); }, onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro") });
              }
            }}
            placeholder="Buscar ou criar…"
            aria-label="Buscar ou criar tag"
            className="mx-1 mb-1 h-8 w-[calc(100%-0.5rem)] rounded-md border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <div className="max-h-56 overflow-y-auto">
            {visible.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <input type="checkbox" checked={tagIds.includes(t.id)} onChange={() => toggle(t.id)} className="accent-[var(--brand)]" />
                {t.name}
              </label>
            ))}
          </div>
          {filter.trim() && !exact && (
            <>
              <DropdownMenuSeparator />
              <p className="px-2 py-1 text-xs text-muted-foreground">Enter para criar “{filter.trim()}”</p>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
