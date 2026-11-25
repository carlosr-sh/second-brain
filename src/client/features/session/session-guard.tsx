import { LockKeyholeIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { onSessionExpired } from "@/lib/api";

/**
 * Goes through /auth/login (never served by the service worker) so the
 * request really reaches Cloudflare Access; afterwards the Worker sends the
 * user back to the page they were on.
 */
export function reloginUrl(loc: Pick<Location, "pathname" | "search"> = window.location): string {
  return `/auth/login?next=${encodeURIComponent(loc.pathname + loc.search)}`;
}

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
        <Button onClick={() => window.location.assign(reloginUrl())}>Entrar novamente</Button>
      </div>
    </div>
  );
}
