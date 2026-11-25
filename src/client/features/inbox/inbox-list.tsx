import { CheckIcon, CheckSquareIcon, ExternalLinkIcon, StickyNoteIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { InboxItem } from "@shared/inbox";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTaskEditor } from "@/features/tasks/task-editor-context";
import { useNavigate } from "react-router";
import { useConvertInboxToNote } from "@/features/knowledge/queries";
import { ApiError } from "@/lib/api";
import { useSetInboxProcessed, useTrashInbox } from "./hooks";

function InboxRow({ item, compact }: { item: InboxItem; compact?: boolean }) {
  const setProcessed = useSetInboxProcessed();
  const trash = useTrashInbox();
  const processed = item.processedAt !== null;
  const { openConvert } = useTaskEditor();
  const toNote = useConvertInboxToNote();
  const navigate = useNavigate();

  return (
    <li className="group flex items-start gap-3 px-4 py-3" data-testid="inbox-item">
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm break-words whitespace-pre-wrap", processed && "text-muted-foreground line-through decoration-muted-foreground/40")}>
          {item.content}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <time dateTime={item.createdAt} title={formatDateTime(item.createdAt)}>
            {formatRelative(item.createdAt)}
          </time>
          {item.url && item.url !== item.content && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-64 items-center gap-1 truncate text-brand hover:underline">
              <ExternalLinkIcon className="size-3 shrink-0" />
              <span className="truncate">{new URL(item.url).hostname}</span>
            </a>
          )}
        </div>
      </div>
      {!compact && (
        <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {!processed && (
            <Hint label="Converter em tarefa">
              <Button variant="ghost" size="icon-sm" aria-label="Converter em tarefa" onClick={() => openConvert(item.id, { title: item.content.slice(0, 200), notes: item.content.length > 200 || item.url ? item.content + (item.url && item.url !== item.content ? `\n${item.url}` : "") : null })}>
                <CheckSquareIcon />
              </Button>
            </Hint>
          )}
          {!processed && (
            <Hint label="Converter em nota">
              <Button variant="ghost" size="icon-sm" aria-label="Converter em nota" onClick={() => toNote.mutate(item.id, { onSuccess: (n) => navigate(`/notes/${n.id}`), onError: (e) => toast.error(e instanceof ApiError ? e.message : "Erro") })}>
                <StickyNoteIcon />
              </Button>
            </Hint>
          )}
          <Hint label={processed ? "Reabrir" : "Marcar como processado"}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={processed ? "Reabrir" : "Marcar como processado"}
              onClick={() => setProcessed.mutate({ id: item.id, processed: !processed })}
            >
              {processed ? <RotateCcwIcon /> : <CheckIcon />}
            </Button>
          </Hint>
          <Hint label="Mover para a lixeira">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Mover para a lixeira"
              onClick={() => trash.mutate(item.id, { onSuccess: () => toast("Item movido para a lixeira") })}
            >
              <Trash2Icon />
            </Button>
          </Hint>
        </div>
      )}
    </li>
  );
}

export function InboxList({ items, compact }: { items: InboxItem[]; compact?: boolean }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((item) => (
        <InboxRow key={item.id} item={item} compact={compact} />
      ))}
    </ul>
  );
}
