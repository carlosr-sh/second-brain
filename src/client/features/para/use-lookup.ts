import { useMemo } from "react";
import { useAreas, useProjects } from "./queries";

/** id → name maps for showing where a task lives. */
export function useParaLookup() {
  const projects = useProjects();
  const areas = useAreas();
  return useMemo(
    () => ({
      projects: projects.data ?? [],
      areas: areas.data ?? [],
      projectName: new Map((projects.data ?? []).map((p) => [p.id, p.name])),
      areaName: new Map((areas.data ?? []).map((a) => [a.id, a.name])),
    }),
    [projects.data, areas.data],
  );
}
