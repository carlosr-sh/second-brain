import type { GOAL_HORIZON, GOAL_STATUS, PRIORITY, PROJECT_STATUS, TASK_STATUS } from "@shared/enums";

type Labels<T extends readonly string[]> = Record<T[number], string>;

export const TASK_STATUS_LABEL: Labels<typeof TASK_STATUS> = {
  todo: "A fazer", in_progress: "Fazendo", waiting: "Aguardando", done: "Concluída", cancelled: "Cancelada",
};
export const PROJECT_STATUS_LABEL: Labels<typeof PROJECT_STATUS> = {
  planned: "Planejado", active: "Ativo", on_hold: "Pausado", completed: "Concluído", cancelled: "Cancelado",
};
export const GOAL_STATUS_LABEL: Labels<typeof GOAL_STATUS> = {
  not_started: "Não iniciada", in_progress: "Em andamento", achieved: "Alcançada", abandoned: "Abandonada",
};
export const GOAL_HORIZON_LABEL: Labels<typeof GOAL_HORIZON> = {
  week: "Semana", month: "Mês", quarter: "Trimestre", year: "Ano", long_term: "Longo prazo",
};
export const PRIORITY_LABEL: Labels<typeof PRIORITY> = {
  none: "Sem prioridade", low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
};
/** Tailwind text color per priority (none = no indicator). */
export const PRIORITY_COLOR: Labels<typeof PRIORITY> = {
  none: "", low: "text-sky-500", medium: "text-amber-500", high: "text-orange-500", urgent: "text-red-500",
};
export const PRIORITY_RANK: Record<keyof typeof PRIORITY_LABEL, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

export const OPEN_TASK_STATUSES = ["todo", "in_progress", "waiting"] as const;
