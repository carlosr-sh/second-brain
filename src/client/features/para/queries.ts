import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  Area, CreateAreaInput, CreateGoalInput, CreateProjectInput, CreateTaskInput, Goal, Project, Task, TaskUpdateResult,
  TrashEntity, TrashItem, UpdateAreaInput, UpdateGoalInput, UpdateProjectInput, UpdateTaskInput,
} from "@shared/para";
import { toast } from "sonner";
import { isoDateIn } from "@shared/time";
import { api } from "@/lib/api";
import { formatDueDate } from "@/lib/format";

/* ---------- keys ---------- */
export const paraKeys = {
  all: ["para"] as const,
  areas: (archived = false) => ["para", "areas", { archived }] as const,
  area: (id: string) => ["para", "area", id] as const,
  goals: (params: Record<string, string> = {}) => ["para", "goals", params] as const,
  projects: (params: Record<string, string> = {}) => ["para", "projects", params] as const,
  project: (id: string) => ["para", "project", id] as const,
  /** List queries only: optimistic updates assume array data under this prefix. */
  tasks: (params: Record<string, string> = {}) => ["para", "tasks", params] as const,
  task: (id: string) => ["para", "task", id] as const,
  trash: ["para", "trash"] as const,
};

const qs = (params: Record<string, string>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "")).toString();
  return s ? `?${s}` : "";
};

/** Stats (counts, progress) are derived server-side, so any PARA write refreshes all PARA data. */
const invalidateAll = (qc: QueryClient) => qc.invalidateQueries({ queryKey: paraKeys.all });

/* ---------- queries ---------- */
export const useAreas = (archived = false) =>
  useQuery({ queryKey: paraKeys.areas(archived), queryFn: () => api<Area[]>(`/areas${qs({ archived: String(archived) })}`) });
export const useArea = (id: string) => useQuery({ queryKey: paraKeys.area(id), queryFn: () => api<Area>(`/areas/${id}`) });
export const useGoals = (params: Record<string, string> = {}) =>
  useQuery({ queryKey: paraKeys.goals(params), queryFn: () => api<Goal[]>(`/goals${qs(params)}`) });
export const useProjects = (params: Record<string, string> = {}) =>
  useQuery({ queryKey: paraKeys.projects(params), queryFn: () => api<Project[]>(`/projects${qs(params)}`) });
export const useProject = (id: string) => useQuery({ queryKey: paraKeys.project(id), queryFn: () => api<Project>(`/projects/${id}`) });
export const useTasks = (params: Record<string, string> = {}) =>
  useQuery({ queryKey: paraKeys.tasks(params), queryFn: () => api<Task[]>(`/tasks${qs(params)}`) });
export const useTrash = () => useQuery({ queryKey: paraKeys.trash, queryFn: () => api<TrashItem[]>("/trash") });

/* ---------- generic mutation helper ---------- */
function useParaMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => invalidateAll(qc) });
}

export const useCreateArea = () => useParaMutation((v: CreateAreaInput) => api<Area>("/areas", { method: "POST", json: v }));
export const useUpdateArea = () =>
  useParaMutation(({ id, ...v }: UpdateAreaInput & { id: string }) => api<Area>(`/areas/${id}`, { method: "PATCH", json: v }));
export const useCreateGoal = () => useParaMutation((v: CreateGoalInput) => api<Goal>("/goals", { method: "POST", json: v }));
export const useUpdateGoal = () =>
  useParaMutation(({ id, ...v }: UpdateGoalInput & { id: string }) => api<Goal>(`/goals/${id}`, { method: "PATCH", json: v }));
export const useCreateProject = () => useParaMutation((v: CreateProjectInput) => api<Project>("/projects", { method: "POST", json: v }));
export const useCreateTask = () => useParaMutation((v: CreateTaskInput) => api<Task>("/tasks", { method: "POST", json: v }));

/**
 * Moving to trash: refresh everything EXCEPT the trashed item's own detail
 * query — its page is usually still mounted for a moment and would refetch
 * into a 404 before navigation completes.
 */
export function useTrashEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entity, id }: { entity: TrashEntity; id: string }) => api<void>(`/${entity}s/${id}`, { method: "DELETE" }),
    onSettled: (_d, _e, { entity, id }) =>
      qc.invalidateQueries({ queryKey: paraKeys.all, predicate: (q) => !(q.queryKey[1] === entity && q.queryKey[2] === id) }),
  });
}
export const useRestoreEntity = () =>
  useParaMutation(({ entity, id }: { entity: TrashEntity; id: string }) => api<unknown>(`/${entity}s/${id}/restore`, { method: "POST" }));
export const usePurgeEntity = () =>
  useParaMutation(({ entity, id }: { entity: TrashEntity; id: string }) => api<void>(`/trash/${entity}/${id}`, { method: "DELETE" }));
export const useEmptyTrash = () => useParaMutation(() => api<{ purged: number }>("/trash", { method: "DELETE" }));

export function useConvertInboxToTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inboxId, ...v }: CreateTaskInput & { inboxId: string }) =>
      api<Task>(`/inbox/${inboxId}/convert-to-task`, { method: "POST", json: v }),
    onSettled: () => Promise.all([invalidateAll(qc), qc.invalidateQueries({ queryKey: ["inbox"] })]),
  });
}

/* ---------- optimistic updates (checkbox, drag & drop) ---------- */
type Patch<T> = Partial<T> & { id: string };

export function patchListCaches<T extends { id: string }>(qc: QueryClient, prefix: readonly unknown[], patch: Patch<T>) {
  const snapshots = qc.getQueriesData<T[]>({ queryKey: prefix });
  qc.setQueriesData<T[]>({ queryKey: prefix }, (list) =>
    Array.isArray(list) ? list.map((item) => (item.id === patch.id ? { ...item, ...patch } : item)) : list,
  );
  return () => snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...v }: UpdateTaskInput & { id: string }) => api<TaskUpdateResult>(`/tasks/${id}`, { method: "PATCH", json: v }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["para", "tasks"] });
      const { archived: _a, ...visible } = vars;
      return { rollback: patchListCaches<Task>(qc, ["para", "tasks"], visible as Patch<Task>) };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    // Hook-level callbacks always run, even if the calling component unmounted
    // (e.g. a completed task disappears from a list that hides done tasks).
    onSuccess: ({ spawned }) => {
      if (spawned?.dueDate) toast(`Próxima ocorrência criada: ${formatDueDate(spawned.dueDate, isoDateIn(new Date()))}`);
    },
    onSettled: () => invalidateAll(qc),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...v }: UpdateProjectInput & { id: string }) => api<Project>(`/projects/${id}`, { method: "PATCH", json: v }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["para", "projects"] });
      const { archived: _a, ...visible } = vars;
      return { rollback: patchListCaches<Project>(qc, ["para", "projects"], visible as Patch<Project>) };
    },
    onError: (_e, _v, ctx) => ctx?.rollback(),
    onSettled: () => invalidateAll(qc),
  });
}
