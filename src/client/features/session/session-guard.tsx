import { LockKeyholeIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { onSessionExpired } from "@/lib/api";

/** Replaces the app with a re-login prompt once the Access session expires. */
export function SessionGuard({ children }: { children: ReactNode }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => onSessionExpired(() => setExpired(true)), []);

  if (!expired) return children;
  return (
    <div role="alertdialog" aria-labelledby="session-title" className="flex h-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <LockKeyholeIcon className="size-5 text-muted-foreground" />
        </div>
        <h1 id="session-title" className="text-lg font-semibold">Sua sessão expirou</h1>
        <p className="text-sm text-muted-foreground">Por segurança, entre novamente para continuar. Nada do que já foi salvo se perdeu.</p>
        <Button onClick={() => window.location.reload()}>Entrar novamente</Button>
      </div>
    </div>
  );
}
