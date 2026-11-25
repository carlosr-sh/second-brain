import { ArchiveIcon, ArchiveRestoreIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { TrashEntity } from "@shared/para";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRestoreEntity, useTrashEntity } from "./queries";
import { toastError } from "@/lib/toast-error";

/** "⋯" menu with edit / archive / delete for a PARA entity detail page. */
export function EntityActions({ entity, id, archived, onEdit, onArchiveToggle, backTo }: {
  entity: TrashEntity; id: string; archived: boolean; onEdit: () => void; onArchiveToggle: () => void; backTo: string;
}) {
  const trash = useTrashEntity();
  const restore = useRestoreEntity();
  const navigate = useNavigate();
  const remove = () =>
    trash.mutate({ entity, id }, {
      onSuccess: () => {
        navigate(backTo);
        toast("Movido para a lixeira", { action: { label: "Desfazer", onClick: () => restore.mutate({ entity, id }) } });
      },
      onError: (e) => toastError(e, "Erro"),
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Mais ações"><MoreHorizontalIcon /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}><PencilIcon /> Editar</DropdownMenuItem>
        <DropdownMenuItem onSelect={onArchiveToggle}>{archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />} {archived ? "Desarquivar" : "Arquivar"}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={remove} className="text-destructive data-[highlighted]:text-destructive"><Trash2Icon className="text-destructive!" /> Mover para a lixeira</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
