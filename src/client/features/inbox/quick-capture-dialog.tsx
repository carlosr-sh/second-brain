import { InboxIcon } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { httpUrlSchema } from "@shared/inbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useUiState } from "@/app/ui-state";
import { KeysHint } from "@/features/shortcuts/keys-hint";
import { useCaptureInbox } from "./hooks";
import { toastError } from "@/lib/toast-error";

/** If the whole capture is a single URL, store it as the item's link too. */
export function splitCapture(text: string): { content: string; url?: string } {
  const content = text.trim();
  const parsed = httpUrlSchema.safeParse(content);
  return parsed.success ? { content, url: parsed.data } : { content };
}

export function QuickCaptureDialog() {
  const { captureOpen, setCaptureOpen } = useUiState();
  const [text, setText] = useState("");
  const capture = useCaptureInbox();
  const navigate = useNavigate();

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || capture.isPending) return;
    capture.mutate(splitCapture(text), {
      onSuccess: () => {
        setText("");
        setCaptureOpen(false);
        toast.success("Capturado na Inbox", { action: { label: "Ver", onClick: () => navigate("/inbox") } });
      },
      onError: (err) => toastError(err, "Não foi possível salvar"),
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
  };

  return (
    <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <InboxIcon className="size-4 text-brand" /> Captura rápida
            </DialogTitle>
            <DialogDescription>Tire da cabeça agora, organize depois na Inbox.</DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Uma ideia, tarefa, link…"
            aria-label="Conteúdo da captura"
            maxLength={10_000}
            className="min-h-28 text-[15px]"
          />
          <DialogFooter>
            <KeysHint keys="mod+enter" className="mr-auto hidden sm:inline-flex" />
            <Button type="button" variant="ghost" onClick={() => setCaptureOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={!text.trim() || capture.isPending}>
              Capturar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
