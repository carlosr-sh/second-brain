import { PaperclipIcon } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { formatBRL, parseBRL } from "@shared/money";
import type { Category, Transaction } from "@shared/personal";
import { isoDateIn } from "@shared/time";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Segmented } from "@/components/ui/segmented";
import { Textarea } from "@/components/ui/textarea";
import { uploadFile } from "@/features/knowledge/queries";
import { ApiError } from "@/lib/api";
import { useAccounts, useCategories, useContacts, useCreateTransaction, useCreateTransfer, useUpdateTransaction } from "./queries";

const onError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Não foi possível salvar");

/** Amount typed in Brazilian format; parsed with string math (no floats). */
export function MoneyInput({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0,00" aria-invalid={invalid} className="pl-9 text-right tabular-nums" />
    </div>
  );
}

/** <option>s grouped parent → children, filtered by kind. */
export function CategoryOptions({ categories, kind }: { categories: Category[]; kind: "income" | "expense" }) {
  const parents = categories.filter((c) => c.kind === kind && !c.parentId);
  return (
    <>
      {parents.map((p) => {
        const children = categories.filter((c) => c.parentId === p.id);
        return children.length ? (
          <optgroup key={p.id} label={p.name}>
            <option value={p.id}>{p.name} (geral)</option>
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </optgroup>
        ) : <option key={p.id} value={p.id}>{p.name}</option>;
      })}
    </>
  );
}

export function TransactionDialog({ open, onOpenChange, transaction, defaultAccountId }: { open: boolean; onOpenChange: (o: boolean) => void; transaction?: Transaction; defaultAccountId?: string }) {
  const ids = useId();
  const accounts = useAccounts();
  const categories = useCategories();
  const contacts = useContacts();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const isTransfer = transaction?.kind === "transfer";
  const [kind, setKind] = useState<"income" | "expense">(transaction?.kind === "income" ? "income" : "expense");
  const [amount, setAmount] = useState(transaction ? formatBRL(Math.abs(transaction.amountCents)).replace(/^-?R\$\s?/, "") : "");
  const [date, setDate] = useState(transaction?.date ?? isoDateIn(new Date()));
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [accountId, setAccountId] = useState(transaction?.accountId ?? defaultAccountId ?? "");
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [contactId, setContactId] = useState(transaction?.contactId ?? "");
  const [status, setStatus] = useState(transaction?.status ?? "cleared");
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [receipt, setReceipt] = useState<string | null>(transaction?.receiptFileId ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const firstAccount = accounts.data?.[0]?.id ?? "";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseBRL(amount);
    const errs: Record<string, string> = {};
    if (!cents) errs.amount = "Valor inválido (ex.: 1.234,56)";
    if (!description.trim()) errs.description = "Obrigatório";
    if (!isTransfer && !(accountId || firstAccount)) errs.account = "Crie uma conta primeiro";
    setErrors(errs);
    if (Object.keys(errs).length || !cents) return;
    const done = { onSuccess: () => onOpenChange(false), onError };
    if (isTransfer && transaction) {
      update.mutate({ id: transaction.id, amountCents: cents, date, description: description.trim(), notes: notes || null, status }, done);
      return;
    }
    const payload = {
      kind, amountCents: cents, date, description: description.trim(), accountId: accountId || firstAccount, categoryId: categoryId || null,
      contactId: contactId || null, status, notes: notes || null, receiptFileId: receipt,
    };
    if (transaction) update.mutate({ id: transaction.id, ...payload }, done);
    else create.mutate(payload, done);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[8%] max-h-[88vh] overflow-y-auto">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader><DialogTitle>{transaction ? (isTransfer ? "Editar transferência" : "Editar lançamento") : "Novo lançamento"}</DialogTitle></DialogHeader>
          {!isTransfer && (
            <Segmented label="Tipo" value={kind} onChange={(k) => { setKind(k); setCategoryId(""); }} options={[{ value: "expense", label: "Despesa" }, { value: "income", label: "Receita" }]} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${ids}-amount`} label="Valor" error={errors.amount}><MoneyInput id={`${ids}-amount`} value={amount} onChange={setAmount} invalid={!!errors.amount} /></Field>
            <Field id={`${ids}-date`} label="Data"><Input id={`${ids}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="dark:[color-scheme:dark]" /></Field>
          </div>
          <Field id={`${ids}-desc`} label="Descrição" error={errors.description}><Input id={`${ids}-desc`} autoFocus value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} /></Field>
          {!isTransfer && (
            <div className="grid grid-cols-2 gap-3">
              <Field id={`${ids}-account`} label="Conta" error={errors.account}>
                <NativeSelect id={`${ids}-account`} value={accountId || firstAccount} onChange={(e) => setAccountId(e.target.value)}>
                  {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </NativeSelect>
              </Field>
              <Field id={`${ids}-category`} label="Categoria">
                <NativeSelect id={`${ids}-category`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Sem categoria</option>
                  <CategoryOptions categories={categories.data ?? []} kind={kind} />
                </NativeSelect>
              </Field>
              <Field id={`${ids}-contact`} label="Pessoa / empresa">
                <NativeSelect id={`${ids}-contact`} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                  <option value="">—</option>
                  {(contacts.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelect>
              </Field>
              <Field id={`${ids}-status`} label="Situação">
                <NativeSelect id={`${ids}-status`} value={status} onChange={(e) => setStatus(e.target.value as Transaction["status"])}>
                  <option value="cleared">Efetivado</option>
                  <option value="pending">Pendente</option>
                </NativeSelect>
              </Field>
            </div>
          )}
          <Field id={`${ids}-notes`} label="Notas"><Textarea id={`${ids}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={20_000} className="min-h-14" /></Field>
          {!isTransfer && (
            <div className="flex items-center gap-2 text-sm">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><PaperclipIcon /> {receipt ? "Trocar comprovante" : "Anexar comprovante"}</Button>
              {receipt && <a href={`/api/files/${receipt}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">ver</a>}
              <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try { setReceipt((await uploadFile(f)).id); } catch (err) { onError(err); }
              }} />
            </div>
          )}
          <DialogFooter><Button type="submit" variant="brand" disabled={create.isPending || update.isPending}>{transaction ? "Salvar" : "Lançar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TransferDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const ids = useId();
  const accounts = useAccounts();
  const transfer = useCreateTransfer();
  const list = accounts.data ?? [];
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(isoDateIn(new Date()));
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const fromId = from || list[0]?.id || "";
  const toId = to || list.find((a) => a.id !== fromId)?.id || "";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseBRL(amount);
    if (!cents) return setError("Valor inválido (ex.: 1.234,56)");
    if (!fromId || !toId || fromId === toId) return setError("Escolha duas contas diferentes");
    transfer.mutate({ fromAccountId: fromId, toAccountId: toId, amountCents: cents, date, description: description || undefined }, { onSuccess: () => onOpenChange(false), onError });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader><DialogTitle>Transferência entre contas</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${ids}-from`} label="De">
              <NativeSelect id={`${ids}-from`} value={fromId} onChange={(e) => setFrom(e.target.value)}>{list.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</NativeSelect>
            </Field>
            <Field id={`${ids}-to`} label="Para">
              <NativeSelect id={`${ids}-to`} value={toId} onChange={(e) => setTo(e.target.value)}>{list.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</NativeSelect>
            </Field>
            <Field id={`${ids}-amount`} label="Valor" error={error}><MoneyInput id={`${ids}-amount`} value={amount} onChange={setAmount} invalid={!!error} /></Field>
            <Field id={`${ids}-date`} label="Data"><Input id={`${ids}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="dark:[color-scheme:dark]" /></Field>
          </div>
          <Field id={`${ids}-desc`} label="Descrição (opcional)"><Input id={`${ids}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Pagamento da fatura" maxLength={200} /></Field>
          <p className="text-xs text-muted-foreground">Uma transferência não é receita nem despesa: gera dois lançamentos ligados que somam zero.</p>
          <DialogFooter><Button type="submit" variant="brand" disabled={transfer.isPending}>Transferir</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
