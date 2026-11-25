import { PlusIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { CreateTaskInput } from "@shared/para";
import { useCreateTask } from "@/features/para/queries";
import { cn } from "@/lib/utils";
import { toastError } from "@/lib/toast-error";

/** Inline "add task" input; context (project, area, due date, status) comes from `defaults`. */
export function QuickAddTask({ defaults = {}, placeholder = "Adicionar tarefa…", className }: { defaults?: Partial<CreateTaskInput>; placeholder?: string; className?: string }) {
  const [title, setTitle] = useState("");
  const create = useCreateTask();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    create.mutate(
      { ...defaults, title: t },
      { onSuccess: () => setTitle(""), onError: (err) => toastError(err, "Erro ao criar tarefa") },
    );
  };
  return (
    <form onSubmit={submit} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground focus-within:bg-accent/50", className)}>
      <PlusIcon className="size-4 shrink-0" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={200}
        className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
      />
    </form>
  );
}
