import { ArrowLeftIcon, CakeIcon, MailIcon, MessageSquarePlusIcon, PhoneIcon, PlusIcon, Trash2Icon, UserRoundIcon, UsersRoundIcon } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { CONTACT_RELATIONSHIP, INTERACTION_TYPE } from "@shared/enums";
import { isValidBirthday, type Contact, type ContactDetail } from "@shared/personal";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRestoreEntity, useTrashEntity } from "@/features/para/queries";
import { useAddInteraction, useContact, useContacts, useCreateContact, useDeleteInteraction, useUpdateContact } from "@/features/personal/queries";
import { Page, PageHeader } from "@/layout/page";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";

const onError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Erro");
const REL_LABEL: Record<Contact["relationship"], string> = { family: "Família", friend: "Amizade", colleague: "Trabalho", client: "Cliente", mentor: "Mentoria", acquaintance: "Conhecido(a)", other: "Outro" };
const TYPE_LABEL: Record<(typeof INTERACTION_TYPE)[number], string> = { call: "Ligação", meeting: "Encontro", message: "Mensagem", email: "E-mail", event: "Evento", other: "Outro" };
const bday = (c: Contact) => (c.birthday ? `${c.birthday.slice(8)}/${c.birthday.slice(5, 7)}` : "");

function ContactRow({ c }: { c: Contact }) {
  return (
    <li>
      <Link to={`/contacts/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50" data-testid="contact-row">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{c.name.slice(0, 2).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{c.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {[c.company, REL_LABEL[c.relationship], c.lastContactedAt ? `último contato ${formatRelative(c.lastContactedAt)}` : "sem contato registrado"].filter(Boolean).join(" · ")}
          </span>
        </span>
        {c.due && <Badge variant="brand">Para contatar</Badge>}
      </Link>
    </li>
  );
}

export function ContactsPage() {
  const contacts = useContacts();
  const create = useCreateContact();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const all = contacts.data ?? [];
  const f = filter.trim().toLowerCase();
  const shown = useMemo(() => all.filter((c) => !f || [c.name, c.nickname, c.company, c.email].some((v) => v?.toLowerCase().includes(f))), [all, f]);
  const due = all.filter((c) => c.due);
  const birthdays = all.filter((c) => c.daysToBirthday !== null && c.daysToBirthday <= 30).sort((a, b) => a.daysToBirthday! - b.daysToBirthday!);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate({ name: name.trim() }, { onSuccess: (c) => navigate(`/contacts/${c.id}`), onError });
  };
  return (
    <Page wide>
      <PageHeader title="Contatos" description="Pessoas importantes, o que vocês conversaram e quando é hora de falar de novo." />
      <form onSubmit={submit} className="mb-6 flex max-w-md gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do novo contato" aria-label="Nome do novo contato" maxLength={200} />
        <Button type="submit" variant="brand" disabled={!name.trim()}><PlusIcon /> Adicionar</Button>
      </form>
      {contacts.isPending ? <Skeleton className="h-40" /> : !all.length ? <EmptyState icon={UsersRoundIcon} title="Nenhum contato" /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section>
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar…" aria-label="Filtrar contatos" className="mb-3 max-w-xs" />
            <ul className="divide-y rounded-xl border bg-card">{shown.map((c) => <ContactRow key={c.id} c={c} />)}</ul>
          </section>
          <aside className="space-y-6">
            <section aria-label="Para contatar">
              <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Para contatar</h2>
              {due.length ? <ul className="divide-y rounded-xl border bg-card" data-testid="due-list">{due.map((c) => <ContactRow key={c.id} c={c} />)}</ul> : <p className="text-sm text-muted-foreground">Ninguém pendente. Defina uma frequência de contato no perfil.</p>}
            </section>
            <section aria-label="Aniversários">
              <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Aniversários (30 dias)</h2>
              {birthdays.length ? (
                <ul className="space-y-1">
                  {birthdays.map((c) => (
                    <li key={c.id}><Link to={`/contacts/${c.id}`} className="flex items-center gap-2 text-sm hover:underline"><CakeIcon className="size-4 text-brand" />{c.name}<span className="ml-auto text-xs text-muted-foreground">{c.daysToBirthday === 0 ? "hoje!" : `${bday(c)} · em ${c.daysToBirthday} dia(s)`}</span></Link></li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Nenhum nos próximos 30 dias.</p>}
            </section>
          </aside>
        </div>
      )}
    </Page>
  );
}

/* ---------------- detail ---------------- */
function ProfileForm({ contact }: { contact: ContactDetail }) {
  const update = useUpdateContact();
  const [v, setV] = useState({
    name: contact.name, nickname: contact.nickname ?? "", email: contact.email ?? "", phone: contact.phone ?? "", company: contact.company ?? "",
    jobTitle: contact.jobTitle ?? "", relationship: contact.relationship, birthday: contact.birthday ?? "", notes: contact.notes ?? "",
    contactFrequencyDays: contact.contactFrequencyDays ? String(contact.contactFrequencyDays) : "",
  });
  const set = (k: keyof typeof v, value: string) => setV((x) => ({ ...x, [k]: value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Birthday input accepts DD/MM or DD/MM/AAAA; unknown year is stored as 0000.
    let birthday: string | null = null;
    if (v.birthday.trim()) {
      const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(v.birthday.trim()) ?? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.birthday.trim());
      const iso = m ? (m[0].includes("-") ? m[0] : `${m[3] ?? "0000"}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`) : "";
      if (!iso || !isValidBirthday(iso)) return toast.error("Aniversário inválido (use DD/MM ou DD/MM/AAAA)");
      birthday = iso;
    }
    update.mutate({
      id: contact.id, name: v.name.trim(), nickname: v.nickname || null, email: v.email || null, phone: v.phone || null, company: v.company || null,
      jobTitle: v.jobTitle || null, relationship: v.relationship, birthday, notes: v.notes || null,
      contactFrequencyDays: v.contactFrequencyDays ? Number(v.contactFrequencyDays) : null,
    }, { onSuccess: () => toast.success("Contato salvo"), onError });
  };
  const field = (k: keyof typeof v, label: string, props: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <label className="grid gap-1 text-xs text-muted-foreground">{label}<Input value={v[k]} onChange={(e) => set(k, e.target.value)} {...props} /></label>
  );
  const birthdayDisplay = contact.birthday && v.birthday === contact.birthday ? `${contact.birthday.slice(8)}/${contact.birthday.slice(5, 7)}${contact.birthday.startsWith("0000") ? "" : `/${contact.birthday.slice(0, 4)}`}` : v.birthday;
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
      {field("name", "Nome", { maxLength: 200 })}
      {field("nickname", "Apelido", { maxLength: 200 })}
      {field("email", "E-mail", { type: "email" })}
      {field("phone", "Telefone", { inputMode: "tel" })}
      {field("company", "Empresa")}
      {field("jobTitle", "Cargo")}
      <label className="grid gap-1 text-xs text-muted-foreground">Relação
        <NativeSelect value={v.relationship} onChange={(e) => set("relationship", e.target.value)}>{CONTACT_RELATIONSHIP.map((r) => <option key={r} value={r}>{REL_LABEL[r]}</option>)}</NativeSelect>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">Aniversário (DD/MM ou DD/MM/AAAA)<Input value={birthdayDisplay} onChange={(e) => set("birthday", e.target.value)} placeholder="25/12" /></label>
      <label className="grid gap-1 text-xs text-muted-foreground">Falar a cada (dias)<Input type="number" min={1} value={v.contactFrequencyDays} onChange={(e) => set("contactFrequencyDays", e.target.value)} placeholder="ex.: 30" /></label>
      <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">Notas<Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-16" maxLength={20_000} /></label>
      <div className="sm:col-span-2"><Button type="submit" variant="brand" size="sm" disabled={update.isPending}>Salvar</Button></div>
    </form>
  );
}

export function ContactDetailPage() {
  const { id = "" } = useParams();
  const contact = useContact(id);
  const add = useAddInteraction();
  const del = useDeleteInteraction();
  const trash = useTrashEntity();
  const restore = useRestoreEntity();
  const navigate = useNavigate();
  const [summary, setSummary] = useState("");
  const [type, setType] = useState<(typeof INTERACTION_TYPE)[number]>("message");
  if (contact.isPending) return <Page><Skeleton className="h-64" /></Page>;
  if (!contact.data) return <Page><EmptyState icon={UserRoundIcon} title="Contato não encontrado" /></Page>;
  const c = contact.data;
  const log = (e: FormEvent) => {
    e.preventDefault();
    if (summary.trim()) add.mutate({ id: c.id, type, summary: summary.trim() }, { onSuccess: () => setSummary(""), onError });
  };
  return (
    <Page wide>
      <Link to="/contacts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Contatos</Link>
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
        {c.due && <Badge variant="brand">Para contatar</Badge>}
        <div className="ml-auto flex items-center gap-1">
          {c.email && <Button variant="ghost" size="icon-sm" asChild><a href={`mailto:${c.email}`} aria-label="Enviar e-mail"><MailIcon /></a></Button>}
          {c.phone && <Button variant="ghost" size="icon-sm" asChild><a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} aria-label="Ligar"><PhoneIcon /></a></Button>}
          <Button variant="ghost" size="icon-sm" aria-label="Mover para a lixeira" onClick={() => trash.mutate({ entity: "contact", id: c.id }, {
            onSuccess: () => { navigate("/contacts"); toast("Contato movido para a lixeira", { action: { label: "Desfazer", onClick: () => restore.mutate({ entity: "contact", id: c.id }) } }); },
          })}><Trash2Icon /></Button>
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <ProfileForm key={c.id} contact={c} />
        <section aria-label="Interações" className="space-y-3">
          <form onSubmit={log} className="grid gap-2 rounded-xl border bg-card p-3">
            <div className="flex gap-2">
              <NativeSelect aria-label="Tipo de interação" value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-36">{INTERACTION_TYPE.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</NativeSelect>
              <Button type="submit" variant="brand" size="sm" className="ml-auto" disabled={!summary.trim()}><MessageSquarePlusIcon /> Registrar</Button>
            </div>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="O que vocês conversaram?" aria-label="Resumo da interação" className="min-h-16" maxLength={5000} />
          </form>
          <ol className="space-y-2" data-testid="interactions">
            {c.interactions.map((i) => (
              <li key={i.id} className="group rounded-lg border bg-card px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{TYPE_LABEL[i.type]}</span>
                  <time dateTime={i.occurredAt} title={formatDateTime(i.occurredAt)}>{formatRelative(i.occurredAt)}</time>
                  <Button variant="ghost" size="icon-sm" className="ml-auto opacity-0 group-hover:opacity-100" aria-label="Excluir interação" onClick={() => del.mutate({ id: c.id, interactionId: i.id }, { onError })}><Trash2Icon /></Button>
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{i.summary}</p>
              </li>
            ))}
            {!c.interactions.length && <p className="text-sm text-muted-foreground">Nenhuma interação registrada.</p>}
          </ol>
        </section>
      </div>
    </Page>
  );
}
