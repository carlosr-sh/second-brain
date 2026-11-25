import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CreateTaskInput } from "@shared/para";

/** What the global task editor is showing. */
export type EditorTarget =
  | { mode: "edit"; taskId: string }
  | { mode: "create"; defaults: Partial<CreateTaskInput> }
  | { mode: "convert"; inboxId: string; defaults: Partial<CreateTaskInput> };

interface TaskEditorContextValue {
  target: EditorTarget | null;
  openTask: (taskId: string) => void;
  openNew: (defaults?: Partial<CreateTaskInput>) => void;
  openConvert: (inboxId: string, defaults: Partial<CreateTaskInput>) => void;
  close: () => void;
}

const Ctx = createContext<TaskEditorContextValue | null>(null);

export function TaskEditorProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const openTask = useCallback((taskId: string) => setTarget({ mode: "edit", taskId }), []);
  const openNew = useCallback((defaults: Partial<CreateTaskInput> = {}) => setTarget({ mode: "create", defaults }), []);
  const openConvert = useCallback((inboxId: string, defaults: Partial<CreateTaskInput>) => setTarget({ mode: "convert", inboxId, defaults }), []);
  const close = useCallback(() => setTarget(null), []);
  const value = useMemo(() => ({ target, openTask, openNew, openConvert, close }), [target, openTask, openNew, openConvert, close]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTaskEditor(): TaskEditorContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTaskEditor must be used inside <TaskEditorProvider>");
  return ctx;
}
