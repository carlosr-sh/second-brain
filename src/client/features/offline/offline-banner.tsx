import { CloudOffIcon } from "lucide-react";
import { useOnline } from "./use-online";

/** Global notice while offline: what the user sees is a saved copy, and edits are off. */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex shrink-0 items-center gap-2 border-b bg-muted px-4 py-2 text-xs text-muted-foreground">
      <CloudOffIcon className="size-4 shrink-0" aria-hidden />
      <span>
        <strong className="font-medium text-foreground">Sem conexão.</strong> Mostrando os dados salvos neste aparelho — edições desativadas até a conexão voltar.
      </span>
    </div>
  );
}
