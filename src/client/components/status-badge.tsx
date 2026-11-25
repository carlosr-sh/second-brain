interface StatusBadgeProps {
  ok: boolean;
  label: string;
  detail?: string | undefined;
}

export function StatusBadge({ ok, label, detail }: StatusBadgeProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2 text-sm">
        {detail && <span className="text-neutral-500">{detail}</span>}
        <span
          aria-label={ok ? "ok" : "falha"}
          className={`inline-block size-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`}
        />
      </span>
    </div>
  );
}
