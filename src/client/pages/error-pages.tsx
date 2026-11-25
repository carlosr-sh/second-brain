import { CompassIcon, TriangleAlertIcon } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Page } from "@/layout/page";

export function NotFoundPage() {
  return (
    <Page>
      <EmptyState
        icon={CompassIcon}
        title="Página não encontrada"
        description="O endereço não corresponde a nenhum módulo."
        action={<Button variant="outline" size="sm" asChild><Link to="/">Voltar ao início</Link></Button>}
      />
    </Page>
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : "Erro inesperado";
  return (
    <Page>
      <EmptyState
        icon={TriangleAlertIcon}
        title="Algo deu errado nesta tela"
        description={message}
        action={<Button variant="outline" size="sm" onClick={() => window.location.reload()}>Recarregar</Button>}
      />
    </Page>
  );
}
