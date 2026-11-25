import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUiState } from "@/app/ui-state";
import { GLOBAL_SHORTCUTS, NAVIGATION_SHORTCUTS } from "./global-shortcuts";
import { KeysHint } from "./keys-hint";

function Section({ title, items }: { title: string; items: readonly { keys: string; label: string }[] }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="divide-y rounded-lg border">
        {items.map((s) => (
          <li key={s.keys} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
            <span>{s.label}</span>
            <KeysHint keys={s.keys} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useUiState();
  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>Atalhos de uma tecla não funcionam enquanto você digita em um campo.</DialogDescription>
        </DialogHeader>
        <Section title="Geral" items={GLOBAL_SHORTCUTS} />
        <Section title="Navegação" items={NAVIGATION_SHORTCUTS} />
      </DialogContent>
    </Dialog>
  );
}
