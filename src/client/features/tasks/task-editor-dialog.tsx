import { useQuery } from "@tanstack/react-query";
import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from "lucide-react";
import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { PRIORITY, TASK_STATUS } from "@shared/enums";
import { createTaskSchema, type CreateTaskInput, type Task } from "@shared/para";
import { describeRule, RECURRENCE_PRESETS } from "@shared/recurrence";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { KeysHint } from "@/features/shortcuts/keys-hint";
import { PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/features/para/labels";
import { paraKeys, useConvertInboxToTask, useCreateTask, useRestoreEntity, useTasks, useTrashEntity, useUpdateTask } from "@/features/para/queries";
import { useParaLookup } from "@/features/para/use-lookup";
import { api, ApiError } from "@/lib/api";
import { QuickAddTask } from "./quick-add-task";
import { useTaskEditor } from "./task-editor-context";
import { TaskRow } from "./task-row";

interface FormState {
  title: string;
  notes: string;
  status: Task["status"];
  priority: Task["priority"];
  dueDate: string;
  scheduledDate: string;
  location: string; // "", "project:<id>", "area:<id>"
  recurrenceRule: string;
}

const emptyForm: FormState = { title: "", notes: "", status: "todo", priority: "none", dueDate: "", scheduledDate: "", location: "", recurrenceRule: "" };

function fromTask(t: Partial<CreateTaskInput>): FormState {
  return {
    title: t.title ?? "",
    notes: t.notes ?? "",
    status: t.status ?? "todo",
    priority: t.priority ?? "none",
    dueDate: t.dueDate ?? "",
    scheduledDate: t.scheduledDate ?? "",
    location: t.projectId ? `project:${t.projectId}` : t.areaId ? `area:${t.areaId}` : "",
    recurrenceRule: t.recurrenceRule ?? "",
  };
}

function toInput(f: FormState): CreateTaskInput {
  const [kind, id] = f.location.split(":");
  return {
    title: f.title,
    notes: f.notes.trim() ? f.notes : null,
    status: f.status,
    priority: f.priority,
    dueDate: f.dueDate || null,
    scheduledDate: f.scheduledDate || null,
    projectId: kind === "project" ? (id ?? null) : null,
    areaId: kind === "area" ? (id ?? null) : null,
    recurrenceRule: f.recurrenceRule || null,
  };
}

export function TaskEditorDialog() {
  const { target, close } = useTaskEditor();
  const taskId = target?.mode === "edit" ? target.taskId : null;
  const task = useQuery({
    queryKey: paraKeys.task(taskId ?? ""),
    queryFn: () => api<Task>(`/tasks/${taskId}`),
    enabled: !!taskId,
  });

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && close()}>
      <DialogContent className="top-[8%] max-h-[88vh] overflow-y-auto sm:max-w-xl">
        {target?.mode === "edit" ? (
          task.data ? <TaskForm key={task.data.id} task={task.data} /> : <Skeleton className="h-64" />
        ) : target ? (
          <TaskForm key={JSON.stringify(target)} defaults={target.defaults} inboxId={target.mode === "convert" ? target.inboxId : undefined} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({ task, defaults, inboxId }: { task?: Task; defaults?: Partial<CreateTaskInput>; inboxId?: string }) {
  const { close } = useTaskEditor();
  const ids = useId();
  const [form, setForm] = useState<FormState>(() => (task ? fromTask(task) : { ...emptyForm, ...fromTask(defaults ?? {}) }));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const { projects, areas } = useParaLookup();
  const create = useCreateTask();
  const update = useUpdateTask();
  const convert = useConvertInboxToTask();
  const trash = useTrashEntity();
  const restore = useRestoreEntity();
  const isSubtask = !!task?.parentTaskId;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => setErrors({}), [form]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const input = toInput(form);
    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = (issue.path[0] === "projectId" || issue.path[0] === "areaId" ? "location" : issue.path[0]) as keyof FormState;
        errs[key] ??= issue.message;
      }
      setErrors(errs);
      return;
    }
    const onError = (err: unknown) => toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar");
    if (task) {
      // Subtasks inherit their location from the parent: never send it.
      const { projectId, areaId, ...rest } = parsed.data;
      update.mutate({ id: task.id, ...(isSubtask ? rest : { ...rest, projectId, areaId }) }, { onSuccess: close, onError });
    } else if (inboxId) {
      convert.mutate({ inboxId, ...parsed.data }, { onSuccess: () => { toast.success("Tarefa criada a partir da Inbox"); close(); }, onError });
    } else {
      create.mutate({ ...parsed.data, ...(defaults?.parentTaskId ? { parentTaskId: defaults.parentTaskId } : {}) }, { onSuccess: () => { toast.success("Tarefa criada"); close(); }, onError });
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
  };

  const remove = () => {
    if (!task) return;
    trash.mutate({ entity: "task", id: task.id }, {
      onSuccess: () => {
        close();
        toast("Tarefa movida para a lixeira", { action: { label: "Desfazer", onClick: () => restore.mutate({ entity: "task", id: task.id }) } });
      },
    });
  };

  const toggleArchive = () => {
    if (!task) return;
    update.mutate({ id: task.id, archived: !task.archivedAt }, {
      onSuccess: () => { toast(task.archivedAt ? "Tarefa desarquivada" : "Tarefa arquivada"); close(); },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro"),
    });
  };

  const pending = create.isPending || update.isPending || convert.isPending;
  const customRule = form.recurrenceRule && !RECURRENCE_PRESETS.some((p) => p.value === form.recurrenceRule);

  return (
    // NOTE: the subtasks section contains its own <form> (quick add). Forms must not be
    // nested (invalid HTML: Enter would submit the outer form), so it lives outside
    // <form> and the footer buttons reference the form via the `form` attribute.
    <div className="grid gap-4" onKeyDown={onKeyDown}>
    <form id={`${ids}-form`} onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{task ? "Editar tarefa" : inboxId ? "Converter em tarefa" : "Nova tarefa"}</DialogTitle>
        <DialogDescription className={task ? "sr-only" : undefined}>
          {inboxId ? "O item sai da Inbox quando a tarefa for criada." : "Preencha o essencial; o resto pode esperar."}
        </DialogDescription>
      </DialogHeader>

      <Field id={`${ids}-title`} label="Título" error={errors.title}>
        <Input id={`${ids}-title`} autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={200} aria-invalid={!!errors.title} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id={`${ids}-status`} label="Status">
          <NativeSelect id={`${ids}-status`} value={form.status} onChange={(e) => set("status", e.target.value as Task["status"])}>
            {TASK_STATUS.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
          </NativeSelect>
        </Field>
        <Field id={`${ids}-priority`} label="Prioridade">
          <NativeSelect id={`${ids}-priority`} value={form.priority} onChange={(e) => set("priority", e.target.value as Task["priority"])}>
            {PRIORITY.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </NativeSelect>
        </Field>
        <Field id={`${ids}-due`} label="Vencimento" error={errors.dueDate}>
          <Input id={`${ids}-due`} type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} className="dark:[color-scheme:dark]" />
        </Field>
        <Field id={`${ids}-scheduled`} label="Planejada para" error={errors.scheduledDate}>
          <Input id={`${ids}-scheduled`} type="date" value={form.scheduledDate} onChange={(e) => set("scheduledDate", e.target.value)} className="dark:[color-scheme:dark]" />
        </Field>
      </div>

      {!isSubtask && !defaults?.parentTaskId && (
        <Field id={`${ids}-location`} label="Onde vive (PARA)" error={errors.location}>
          <NativeSelect id={`${ids}-location`} value={form.location} onChange={(e) => set("location", e.target.value)}>
            <option value="">Sem projeto ou área</option>
            {projects.length > 0 && (
              <optgroup label="Projetos">
                {projects.map((p) => <option key={p.id} value={`project:${p.id}`}>{p.name}</option>)}
              </optgroup>
            )}
            {areas.length > 0 && (
              <optgroup label="Áreas">
                {areas.map((a) => <option key={a.id} value={`area:${a.id}`}>{a.name}</option>)}
              </optgroup>
            )}
          </NativeSelect>
        </Field>
      )}

      <Field id={`${ids}-recurrence`} label="Repetir" error={errors.recurrenceRule}>
        <NativeSelect id={`${ids}-recurrence`} value={form.recurrenceRule} onChange={(e) => set("recurrenceRule", e.target.value)}>
          <option value="">Não repete</option>
          {RECURRENCE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          {customRule && <option value={form.recurrenceRule}>{describeRule(form.recurrenceRule)}</option>}
        </NativeSelect>
      </Field>

      <Field id={`${ids}-notes`} label="Notas" error={errors.notes}>
        <Textarea id={`${ids}-notes`} value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={20_000} className="min-h-20" />
      </Field>

    </form>

      {task && !isSubtask && <Subtasks parent={task} />}

      <DialogFooter className="gap-2 sm:justify-between">
        <div className="flex gap-1">
          {task && (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={remove} aria-label="Mover para a lixeira">
                <Trash2Icon /> <span className="sm:sr-only">Excluir</span>
              </Button>
              {!isSubtask && (
                <Button type="button" variant="ghost" size="sm" onClick={toggleArchive}>
                  {task.archivedAt ? <ArchiveRestoreIcon /> : <ArchiveIcon />} {task.archivedAt ? "Desarquivar" : "Arquivar"}
                </Button>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <KeysHint keys="mod+enter" className="hidden sm:inline-flex" />
          <Button type="submit" form={`${ids}-form`} variant="brand" disabled={pending}>{task ? "Salvar" : inboxId ? "Criar tarefa" : "Criar"}</Button>
        </div>
      </DialogFooter>
    </div>
  );
}

function Subtasks({ parent }: { parent: Task }) {
  const subtasks = useTasks({ parentTaskId: parent.id });
  const items = subtasks.data ?? [];
  const done = items.filter((t) => t.status === "done").length;
  return (
    <section aria-label="Subtarefas" className="rounded-lg border">
      <header className="flex items-center justify-between px-3 pt-2.5 text-xs font-medium text-muted-foreground">
        <span>Subtarefas</span>
        {items.length > 0 && <span className="tabular-nums">{done}/{items.length}</span>}
      </header>
      <ul className="divide-y">{items.map((t) => <TaskRow key={t.id} task={t} showLocation={false} />)}</ul>
      <QuickAddTask defaults={{ parentTaskId: parent.id }} placeholder="Adicionar subtarefa…" />
    </section>
  );
}
