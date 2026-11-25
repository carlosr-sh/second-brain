import { z } from "./z";
import { isoDateSchema } from "./dates";
import { GOAL_HORIZON, GOAL_STATUS, PRIORITY, PROJECT_STATUS, TASK_STATUS } from "./enums";
import { recurrenceRuleSchema } from "./recurrence";
import { UUID_REGEX } from "./uuid";

/* ---------- primitives ---------- */
const id = z.string().regex(UUID_REGEX, "ID inválido").transform((v) => v.toLowerCase());
const nullableId = id.nullable();
const name = z.string().trim().min(1, "Obrigatório").max(200);
const longText = z.string().max(20_000);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida");
const icon = z.string().max(40);
const position = z.number().finite();
const nullableDate = isoDateSchema.nullable();

/** At least one field must be present in a PATCH body. */
const nonEmpty = <T extends z.ZodObject>(s: T) =>
  s.refine((v) => Object.keys(v).length > 0, "Nenhum campo para atualizar");

/* ---------- areas ---------- */
export const createAreaSchema = z.object({
  name,
  description: longText.nullable().optional(),
  icon: icon.nullable().optional(),
  color: color.nullable().optional(),
});
export const updateAreaSchema = nonEmpty(
  createAreaSchema.partial().extend({ position: position.optional(), archived: z.boolean().optional() }),
);

/* ---------- goals ---------- */
export const createGoalSchema = z.object({
  title: name,
  description: longText.nullable().optional(),
  areaId: nullableId.optional(),
  status: z.enum(GOAL_STATUS).optional(),
  horizon: z.enum(GOAL_HORIZON).optional(),
  targetDate: nullableDate.optional(),
});
export const updateGoalSchema = nonEmpty(createGoalSchema.partial().extend({ archived: z.boolean().optional() }));

/* ---------- projects ---------- */
export const createProjectSchema = z.object({
  name,
  description: longText.nullable().optional(),
  areaId: nullableId.optional(),
  goalId: nullableId.optional(),
  status: z.enum(PROJECT_STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  startDate: nullableDate.optional(),
  dueDate: nullableDate.optional(),
});
export const updateProjectSchema = nonEmpty(
  createProjectSchema.partial().extend({ position: position.optional(), archived: z.boolean().optional() }),
);

/* ---------- tasks ---------- */
export const createTaskSchema = z.object({
  title: name,
  notes: longText.nullable().optional(),
  projectId: nullableId.optional(),
  areaId: nullableId.optional(),
  parentTaskId: nullableId.optional(),
  status: z.enum(TASK_STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  dueDate: nullableDate.optional(),
  scheduledDate: nullableDate.optional(),
  recurrenceRule: recurrenceRuleSchema.nullable().optional(),
});
export const updateTaskSchema = nonEmpty(
  createTaskSchema.partial().extend({ position: position.optional(), archived: z.boolean().optional() }),
);

const csv = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(z.enum(values)));

export const taskListQuerySchema = z.object({
  projectId: id.optional(),
  /** Tasks directly in the area OR in any of its projects. */
  areaId: id.optional(),
  status: csv(TASK_STATUS).optional(),
  dueFrom: isoDateSchema.optional(),
  dueTo: isoDateSchema.optional(),
  /** Subtasks of a given task. */
  parentTaskId: id.optional(),
  /** Only tasks with no project and no area. */
  unassigned: z.enum(["true"]).optional(),
  archived: z.enum(["true", "false"]).default("false"),
});

export const listArchivedQuerySchema = z.object({ archived: z.enum(["true", "false"]).default("false") });

/* ---------- inbox → task ---------- */
export const convertInboxToTaskSchema = createTaskSchema.omit({ parentTaskId: true });

/* ---------- DTOs ---------- */
interface Timestamps {
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Area extends Timestamps {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  position: number;
  stats: { activeProjects: number; openTasks: number };
}

export interface Goal extends Timestamps {
  id: string;
  areaId: string | null;
  title: string;
  description: string | null;
  status: (typeof GOAL_STATUS)[number];
  horizon: (typeof GOAL_HORIZON)[number];
  targetDate: string | null;
  achievedAt: string | null;
  /** Derived from linked projects (cancelled ones excluded). */
  progress: { completed: number; total: number };
}

export interface Project extends Timestamps {
  id: string;
  areaId: string | null;
  goalId: string | null;
  name: string;
  description: string | null;
  status: (typeof PROJECT_STATUS)[number];
  priority: (typeof PRIORITY)[number];
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  position: number;
  taskStats: { open: number; done: number };
}

export interface Task extends Timestamps {
  id: string;
  projectId: string | null;
  areaId: string | null;
  parentTaskId: string | null;
  title: string;
  notes: string | null;
  status: (typeof TASK_STATUS)[number];
  priority: (typeof PRIORITY)[number];
  dueDate: string | null;
  scheduledDate: string | null;
  recurrenceRule: string | null;
  completedAt: string | null;
  position: number;
}

/** Response of a task update: `spawned` is the next occurrence of a recurring task. */
export interface TaskUpdateResult {
  task: Task;
  spawned: Task | null;
}

export type TrashEntity =
  | "area" | "goal" | "project" | "task" | "note" | "notebook" | "resource" | "bookmark" | "book"
  | "account" | "category" | "transaction" | "habit" | "journal" | "contact";

/** REST collection path per trashable entity (explicit: "category" → "categories"). */
export const ENTITY_PATH: Record<TrashEntity, string> = {
  area: "areas", goal: "goals", project: "projects", task: "tasks", note: "notes", notebook: "notebooks", resource: "resources",
  bookmark: "bookmarks", book: "books", account: "accounts", category: "categories", transaction: "transactions", habit: "habits",
  journal: "journals", contact: "contacts",
};
export interface TrashItem {
  entity: TrashEntity;
  id: string;
  title: string;
  deletedAt: string;
}

export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
