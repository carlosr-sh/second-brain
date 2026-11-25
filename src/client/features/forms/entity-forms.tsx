import { useId, type FormEvent, type ReactNode } from "react";
import { GOAL_HORIZON, GOAL_STATUS, PRIORITY, PROJECT_STATUS } from "@shared/enums";
import {
  createAreaSchema, createGoalSchema, createProjectSchema,
  type Area, type CreateAreaInput, type CreateGoalInput, type CreateProjectInput, type Goal, type Project,
} from "@shared/para";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { GOAL_HORIZON_LABEL, GOAL_STATUS_LABEL, PRIORITY_LABEL, PROJECT_STATUS_LABEL } from "@/features/para/labels";
import { useAreas, useCreateArea, useCreateGoal, useCreateProject, useGoals, useUpdateArea, useUpdateGoal, useUpdateProject } from "@/features/para/queries";
import { useZodForm } from "./use-form";
import { toastError } from "@/lib/toast-error";

const onApiError = (err: unknown) => toastError(err, "Não foi possível salvar");
const orNull = (s: string) => (s.trim() ? s : null);

function FormDialog({ open, onOpenChange, title, onSubmit, pending, children, submitLabel }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; onSubmit: () => void; pending: boolean; children: ReactNode; submitLabel: string;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[10%] max-h-[85vh] overflow-y-auto">
        <form onSubmit={submit} noValidate className="grid gap-4" onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmit()}>
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="brand" disabled={pending}>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AreaSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const areas = useAreas();
  return (
    <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Nenhuma</option>
      {(areas.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </NativeSelect>
  );
}

/* ---------- Area ---------- */
export function AreaFormDialog({ open, onOpenChange, area }: { open: boolean; onOpenChange: (o: boolean) => void; area?: Area }) {
  const ids = useId();
  const create = useCreateArea();
  const update = useUpdateArea();
  const form = useZodForm(createAreaSchema, { name: area?.name ?? "", description: area?.description ?? "" }, (f): CreateAreaInput => ({ name: f.name, description: orNull(f.description) }));
  const submit = () => {
    const data = form.validate();
    if (!data) return;
    const done = { onSuccess: () => onOpenChange(false), onError: onApiError };
    if (area) update.mutate({ id: area.id, ...data }, done);
    else create.mutate(data, done);
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={area ? "Editar área" : "Nova área"} onSubmit={submit} pending={create.isPending || update.isPending} submitLabel={area ? "Salvar" : "Criar área"}>
      <Field id={`${ids}-name`} label="Nome" error={form.errors.name}>
        <Input id={`${ids}-name`} autoFocus value={form.values.name} onChange={(e) => form.set("name", e.target.value)} placeholder="Ex.: Saúde, Finanças, Carreira" maxLength={200} />
      </Field>
      <Field id={`${ids}-desc`} label="Descrição (padrão que você quer manter)">
        <Textarea id={`${ids}-desc`} value={form.values.description} onChange={(e) => form.set("description", e.target.value)} maxLength={20_000} />
      </Field>
    </FormDialog>
  );
}

/* ---------- Goal ---------- */
export function GoalFormDialog({ open, onOpenChange, goal, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; goal?: Goal; defaults?: Partial<CreateGoalInput> }) {
  const ids = useId();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const initial = {
    title: goal?.title ?? "", description: goal?.description ?? "", areaId: goal?.areaId ?? defaults?.areaId ?? "",
    status: goal?.status ?? "not_started", horizon: goal?.horizon ?? "quarter", targetDate: goal?.targetDate ?? "",
  };
  const form = useZodForm(createGoalSchema, initial, (f): CreateGoalInput => ({
    title: f.title, description: orNull(f.description), areaId: f.areaId || null, status: f.status as Goal["status"],
    horizon: f.horizon as Goal["horizon"], targetDate: f.targetDate || null,
  }));
  const submit = () => {
    const data = form.validate();
    if (!data) return;
    const done = { onSuccess: () => onOpenChange(false), onError: onApiError };
    if (goal) update.mutate({ id: goal.id, ...data }, done);
    else create.mutate(data, done);
  };
  const v = form.values;
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={goal ? "Editar meta" : "Nova meta"} onSubmit={submit} pending={create.isPending || update.isPending} submitLabel={goal ? "Salvar" : "Criar meta"}>
      <Field id={`${ids}-title`} label="Meta" error={form.errors.title}>
        <Input id={`${ids}-title`} autoFocus value={v.title} onChange={(e) => form.set("title", e.target.value)} placeholder="Ex.: Correr uma meia maratona" maxLength={200} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${ids}-horizon`} label="Horizonte">
          <NativeSelect id={`${ids}-horizon`} value={v.horizon} onChange={(e) => form.set("horizon", e.target.value as Goal["horizon"])}>
            {GOAL_HORIZON.map((h) => <option key={h} value={h}>{GOAL_HORIZON_LABEL[h]}</option>)}
          </NativeSelect>
        </Field>
        <Field id={`${ids}-status`} label="Status">
          <NativeSelect id={`${ids}-status`} value={v.status} onChange={(e) => form.set("status", e.target.value as Goal["status"])}>
            {GOAL_STATUS.map((s) => <option key={s} value={s}>{GOAL_STATUS_LABEL[s]}</option>)}
          </NativeSelect>
        </Field>
        <Field id={`${ids}-area`} label="Área"><AreaSelect id={`${ids}-area`} value={v.areaId} onChange={(x) => form.set("areaId", x)} /></Field>
        <Field id={`${ids}-target`} label="Prazo" error={form.errors.targetDate}>
          <Input id={`${ids}-target`} type="date" value={v.targetDate} onChange={(e) => form.set("targetDate", e.target.value)} className="dark:[color-scheme:dark]" />
        </Field>
      </div>
      <Field id={`${ids}-desc`} label="Por que isso importa?">
        <Textarea id={`${ids}-desc`} value={v.description} onChange={(e) => form.set("description", e.target.value)} maxLength={20_000} />
      </Field>
    </FormDialog>
  );
}

/* ---------- Project ---------- */
export function ProjectFormDialog({ open, onOpenChange, project, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; project?: Project; defaults?: Partial<CreateProjectInput> }) {
  const ids = useId();
  const create = useCreateProject();
  const update = useUpdateProject();
  const goals = useGoals();
  const initial = {
    name: project?.name ?? "", description: project?.description ?? "", areaId: project?.areaId ?? defaults?.areaId ?? "",
    goalId: project?.goalId ?? defaults?.goalId ?? "", status: project?.status ?? defaults?.status ?? "active",
    priority: project?.priority ?? "none", startDate: project?.startDate ?? "", dueDate: project?.dueDate ?? "",
  };
  const form = useZodForm(createProjectSchema, initial, (f): CreateProjectInput => ({
    name: f.name, description: orNull(f.description), areaId: f.areaId || null, goalId: f.goalId || null,
    status: f.status as Project["status"], priority: f.priority as Project["priority"], startDate: f.startDate || null, dueDate: f.dueDate || null,
  }));
  const submit = () => {
    const data = form.validate();
    if (!data) return;
    const done = { onSuccess: () => onOpenChange(false), onError: onApiError };
    if (project) update.mutate({ id: project.id, ...data }, done);
    else create.mutate(data, done);
  };
  const v = form.values;
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={project ? "Editar projeto" : "Novo projeto"} onSubmit={submit} pending={create.isPending || update.isPending} submitLabel={project ? "Salvar" : "Criar projeto"}>
      <Field id={`${ids}-name`} label="Nome" error={form.errors.name}>
        <Input id={`${ids}-name`} autoFocus value={v.name} onChange={(e) => form.set("name", e.target.value)} placeholder="Um resultado concreto, com fim" maxLength={200} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${ids}-status`} label="Status">
          <NativeSelect id={`${ids}-status`} value={v.status} onChange={(e) => form.set("status", e.target.value as Project["status"])}>
            {PROJECT_STATUS.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}
          </NativeSelect>
        </Field>
        <Field id={`${ids}-priority`} label="Prioridade">
          <NativeSelect id={`${ids}-priority`} value={v.priority} onChange={(e) => form.set("priority", e.target.value as Project["priority"])}>
            {PRIORITY.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </NativeSelect>
        </Field>
        <Field id={`${ids}-area`} label="Área"><AreaSelect id={`${ids}-area`} value={v.areaId} onChange={(x) => form.set("areaId", x)} /></Field>
        <Field id={`${ids}-goal`} label="Meta">
          <NativeSelect id={`${ids}-goal`} value={v.goalId} onChange={(e) => form.set("goalId", e.target.value)}>
            <option value="">Nenhuma</option>
            {(goals.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </NativeSelect>
        </Field>
        <Field id={`${ids}-start`} label="Início" error={form.errors.startDate}>
          <Input id={`${ids}-start`} type="date" value={v.startDate} onChange={(e) => form.set("startDate", e.target.value)} className="dark:[color-scheme:dark]" />
        </Field>
        <Field id={`${ids}-due`} label="Prazo" error={form.errors.dueDate}>
          <Input id={`${ids}-due`} type="date" value={v.dueDate} onChange={(e) => form.set("dueDate", e.target.value)} className="dark:[color-scheme:dark]" />
        </Field>
      </div>
      <Field id={`${ids}-desc`} label="Descrição / critério de conclusão">
        <Textarea id={`${ids}-desc`} value={v.description} onChange={(e) => form.set("description", e.target.value)} maxLength={20_000} />
      </Field>
    </FormDialog>
  );
}
