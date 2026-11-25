import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Account, BalancePoint, Category, CategoryTotal, Contact, ContactDetail, CreateContactInput, CreateHabitInput, CreateTransactionInput,
  CreateTransferInput, Habit, JournalEntry, JournalSummary, MonthSummary, Transaction, UpdateContactInput, UpdateHabitInput,
  UpdateTransactionInput, UpsertJournalInput,
} from "@shared/personal";
import { api } from "@/lib/api";

export const lifeKeys = {
  all: ["life"] as const,
  accounts: (archived = false) => ["life", "accounts", { archived }] as const,
  categories: ["life", "categories"] as const,
  transactions: (p: Record<string, string>) => ["life", "transactions", p] as const,
  transaction: (id: string) => ["life", "transaction", id] as const,
  summary: (months: number) => ["life", "summary", months] as const,
  byCategory: (month: string) => ["life", "by-category", month] as const,
  balance: (from: string, to: string) => ["life", "balance", from, to] as const,
  habits: ["life", "habits"] as const,
  journalDay: (date: string) => ["life", "journal-day", date] as const,
  journalRange: (from: string, to: string) => ["life", "journal-range", from, to] as const,
  contacts: ["life", "contacts"] as const,
  contact: (id: string) => ["life", "contact", id] as const,
};

const qs = (p: Record<string, string>) => {
  const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== "")).toString();
  return s ? `?${s}` : "";
};

/* ---------- finance ---------- */
export const useAccounts = (archived = false) => useQuery({ queryKey: lifeKeys.accounts(archived), queryFn: () => api<Account[]>(`/accounts?archived=${archived}`) });
export const useCategories = () => useQuery({ queryKey: lifeKeys.categories, queryFn: () => api<Category[]>("/categories") });
export const useTransactions = (p: Record<string, string>) => useQuery({ queryKey: lifeKeys.transactions(p), queryFn: () => api<Transaction[]>(`/transactions${qs(p)}`) });
export const useTransaction = (id: string | null) =>
  useQuery({ queryKey: lifeKeys.transaction(id ?? ""), queryFn: () => api<Transaction>(`/transactions/${id}`), enabled: !!id });
export const useMonthlySummary = (months = 12) => useQuery({ queryKey: lifeKeys.summary(months), queryFn: () => api<MonthSummary[]>(`/finance/summary?months=${months}`) });
export const useByCategory = (month: string) => useQuery({ queryKey: lifeKeys.byCategory(month), queryFn: () => api<CategoryTotal[]>(`/finance/by-category?month=${month}`) });
export const useBalanceSeries = (from: string, to: string) =>
  useQuery({ queryKey: lifeKeys.balance(from, to), queryFn: () => api<BalancePoint[]>(`/finance/balance?from=${from}&to=${to}`) });

/** Every finance write refreshes balances, reports and lists (all derived server-side). */
function useLifeMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: lifeKeys.all }), qc.invalidateQueries({ queryKey: ["para", "trash"] })]) });
}

export const useCreateAccount = () => useLifeMutation((v: { name: string; type?: Account["type"]; openingBalanceCents?: number; institution?: string | null }) => api<Account>("/accounts", { method: "POST", json: v }));
export const useUpdateAccount = () =>
  useLifeMutation(({ id, ...v }: { id: string; name?: string; type?: Account["type"]; openingBalanceCents?: number; institution?: string | null; archived?: boolean }) =>
    api<Account>(`/accounts/${id}`, { method: "PATCH", json: v }));
export const useCreateCategory = () => useLifeMutation((v: { name: string; kind: Category["kind"]; parentId?: string | null }) => api<Category>("/categories", { method: "POST", json: v }));
export const useUpdateCategory = () => useLifeMutation(({ id, ...v }: { id: string; name?: string; archived?: boolean }) => api<Category>(`/categories/${id}`, { method: "PATCH", json: v }));
export const useSeedCategories = () => useLifeMutation(() => api<{ created: number }>("/categories/defaults", { method: "POST" }));
export const useCreateTransaction = () => useLifeMutation((v: CreateTransactionInput) => api<Transaction>("/transactions", { method: "POST", json: v }));
export const useCreateTransfer = () => useLifeMutation((v: CreateTransferInput) => api<Transaction[]>("/transactions/transfer", { method: "POST", json: v }));
export const useUpdateTransaction = () => useLifeMutation(({ id, ...v }: UpdateTransactionInput & { id: string }) => api<Transaction>(`/transactions/${id}`, { method: "PATCH", json: v }));

/* ---------- habits ---------- */
export const useHabits = () => useQuery({ queryKey: lifeKeys.habits, queryFn: () => api<Habit[]>("/habits") });
export const useCreateHabit = () => useLifeMutation((v: CreateHabitInput) => api<Habit>("/habits", { method: "POST", json: v }));
export const useUpdateHabit = () => useLifeMutation(({ id, ...v }: UpdateHabitInput & { id: string }) => api<Habit>(`/habits/${id}`, { method: "PATCH", json: v }));

/** Check-in with optimistic stats-free update of the logs (server recomputes streaks). */
export function useHabitLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, count }: { id: string; date: string; count: number }) => api<Habit>(`/habits/${id}/logs/${date}`, { method: "PUT", json: { count } }),
    onSuccess: (habit) => qc.setQueryData<Habit[]>(lifeKeys.habits, (list) => list?.map((h) => (h.id === habit.id ? habit : h))),
  });
}

/* ---------- journal ---------- */
export const useJournalDay = (date: string) =>
  useQuery({
    queryKey: lifeKeys.journalDay(date),
    queryFn: () => api<JournalEntry | null>(`/journal/${date}`), // null = nothing written that day yet
    staleTime: Infinity,
  });
export const useJournalRange = (from: string, to: string) =>
  useQuery({ queryKey: lifeKeys.journalRange(from, to), queryFn: () => api<JournalSummary[]>(`/journal?from=${from}&to=${to}`) });
export function useSaveJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, keepalive, ...v }: UpsertJournalInput & { date: string; keepalive?: boolean }) => api<JournalEntry>(`/journal/${date}`, { method: "PUT", json: v, keepalive }),
    onSuccess: (entry) => {
      qc.setQueryData(lifeKeys.journalDay(entry.date), entry);
      void qc.invalidateQueries({ queryKey: ["life", "journal-range"] });
    },
  });
}

/* ---------- contacts ---------- */
export const useContacts = () => useQuery({ queryKey: lifeKeys.contacts, queryFn: () => api<Contact[]>("/contacts") });
export const useContact = (id: string) => useQuery({ queryKey: lifeKeys.contact(id), queryFn: () => api<ContactDetail>(`/contacts/${id}`) });
export const useCreateContact = () => useLifeMutation((v: CreateContactInput) => api<ContactDetail>("/contacts", { method: "POST", json: v }));
export const useUpdateContact = () => useLifeMutation(({ id, ...v }: UpdateContactInput & { id: string }) => api<ContactDetail>(`/contacts/${id}`, { method: "PATCH", json: v }));
export const useAddInteraction = () =>
  useLifeMutation(({ id, ...v }: { id: string; type?: string; summary: string; occurredAt?: string }) => api<ContactDetail>(`/contacts/${id}/interactions`, { method: "POST", json: v }));
export const useDeleteInteraction = () =>
  useLifeMutation(({ id, interactionId }: { id: string; interactionId: string }) => api<ContactDetail>(`/contacts/${id}/interactions/${interactionId}`, { method: "DELETE" }));
