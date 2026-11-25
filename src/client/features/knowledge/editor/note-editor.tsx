import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon, CodeIcon, Heading1Icon, Heading2Icon, Heading3Icon, HighlighterIcon, ImageIcon, ItalicIcon, LinkIcon, ListIcon,
  ListChecksIcon, ListOrderedIcon, QuoteIcon, SquareCodeIcon, StrikethroughIcon, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { RichDoc } from "@shared/rich-text";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Hint } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Note, SearchResult } from "@shared/knowledge";
import { HL_END, HL_START } from "@shared/knowledge";
import { uploadFile } from "../queries";
import { NoteLink } from "./note-link";
import { toastError } from "@/lib/toast-error";
import { useOnline } from "@/features/offline/use-online";

const SAFE_URL = /^(https?:\/\/|mailto:|\/(?!\/))/i;
const strip = (s: string) => s.replaceAll(HL_START, "").replaceAll(HL_END, "");

async function searchNotes(query: string) {
  const q = query.trim();
  if (q.length < 1) {
    const recent = await api<{ id: string; title: string }[]>("/notes");
    return recent.slice(0, 7).map((n) => ({ id: n.id, label: n.title || "(sem título)" }));
  }
  const results = await api<SearchResult[]>(`/search?types=note&limit=7&q=${encodeURIComponent(q)}`);
  return results.map((r) => ({ id: r.id, label: strip(r.title) || "(sem título)" }));
}

async function createNote(label: string) {
  const note = await api<Note>("/notes", { method: "POST", json: { title: label } });
  toast(`Nota “${label}” criada`);
  return { id: note.id, label };
}

export interface NoteEditorProps {
  noteId: string;
  initialContent: RichDoc;
  onChange: (doc: RichDoc) => void;
  editable?: boolean;
}

/** Rich-text editor. Produces ONLY whitelisted nodes (mirrors the server sanitizer). */
export function NoteEditor({ noteId, initialContent, onChange, editable = true }: NoteEditorProps) {
  const navigate = useNavigate();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const insertFiles = async (editor: Editor, files: File[], pos?: number) => {
    for (const file of files) {
      const id = toast.loading(`Enviando ${file.name}…`);
      try {
        const stored = await uploadFile(file);
        // No filename as alt text: it is noise in search results and excerpts.
        const node = { type: "image", attrs: { src: stored.url, alt: "" } };
        if (pos !== undefined) editor.chain().focus().insertContentAt(pos, node).run();
        else editor.chain().focus().insertContent(node).run();
        toast.success("Imagem adicionada", { id });
      } catch (e) {
        toastError(e, "Falha no envio", { id });
      }
    }
  };

  const online = useOnline();
  const canEdit = editable && online; // offline = read-only (nothing could be saved)
  const editor = useEditor({
    editable: canEdit,
    content: initialContent,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (url) => SAFE_URL.test(url),
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        },
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ allowBase64: false }),
      Placeholder.configure({ placeholder: "Escreva… use [[ para vincular outra nota, ## para títulos, - para listas." }),
      NoteLink.configure({ search: searchNotes, create: createNote, currentNoteId: noteId }),
    ],
    editorProps: {
      attributes: { class: "prose-note outline-none", "aria-label": "Conteúdo da nota", role: "textbox", "aria-multiline": "true" },
      handleClick: (_view, _pos, event) => {
        const a = (event.target as HTMLElement).closest("a");
        if (!a) return false;
        const noteId = a.getAttribute("data-note-id");
        if (noteId) {
          event.preventDefault();
          navigate(`/notes/${noteId}`);
          return true;
        }
        if (event.metaKey || event.ctrlKey) {
          window.open(a.href, "_blank", "noopener,noreferrer");
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (!files.length || !editorRef.current) return false;
        void insertFiles(editorRef.current, files, view.state.selection.from);
        return true;
      },
      handleDrop: (view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (!files.length || !editorRef.current) return false;
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertFiles(editorRef.current, files, pos);
        return true;
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON() as RichDoc),
  });
  // useEditor only reads `editable` at creation: follow connectivity changes.
  useEffect(() => {
    if (editor && editor.isEditable !== canEdit) editor.setEditable(canEdit);
  }, [editor, canEdit]);
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;

  return (
    <div className="flex flex-col gap-2">
      {canEdit && <Toolbar editor={editor} onImage={(files) => insertFiles(editor, files)} />}
      <EditorContent editor={editor} className="min-h-[50vh]" />
    </div>
  );
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: (files: File[]) => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"), italic: e.isActive("italic"), strike: e.isActive("strike"), code: e.isActive("code"),
      highlight: e.isActive("highlight"), h1: e.isActive("heading", { level: 1 }), h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }), bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"), quote: e.isActive("blockquote"), codeBlock: e.isActive("codeBlock"), link: e.isActive("link"),
    }),
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const c = () => editor.chain().focus();

  const tools: [LucideIcon, string, boolean, () => void][][] = [
    [
      [BoldIcon, "Negrito (Ctrl+B)", state.bold, () => c().toggleBold().run()],
      [ItalicIcon, "Itálico (Ctrl+I)", state.italic, () => c().toggleItalic().run()],
      [StrikethroughIcon, "Riscado", state.strike, () => c().toggleStrike().run()],
      [HighlighterIcon, "Destacar", state.highlight, () => c().toggleHighlight().run()],
      [CodeIcon, "Código", state.code, () => c().toggleCode().run()],
    ],
    [
      [Heading1Icon, "Título 1", state.h1, () => c().toggleHeading({ level: 1 }).run()],
      [Heading2Icon, "Título 2", state.h2, () => c().toggleHeading({ level: 2 }).run()],
      [Heading3Icon, "Título 3", state.h3, () => c().toggleHeading({ level: 3 }).run()],
    ],
    [
      [ListIcon, "Lista", state.bullet, () => c().toggleBulletList().run()],
      [ListOrderedIcon, "Lista numerada", state.ordered, () => c().toggleOrderedList().run()],
      [ListChecksIcon, "Lista de tarefas", state.task, () => c().toggleTaskList().run()],
      [QuoteIcon, "Citação", state.quote, () => c().toggleBlockquote().run()],
      [SquareCodeIcon, "Bloco de código", state.codeBlock, () => c().toggleCodeBlock().run()],
    ],
    [
      [LinkIcon, "Link", state.link, () => (state.link ? c().unsetLink().run() : setLinkOpen(true))],
      [ImageIcon, "Imagem", false, () => fileInput.current?.click()],
    ],
  ];

  return (
    <div role="toolbar" aria-label="Formatação" className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-0.5 border-b bg-background/90 px-1 py-1 backdrop-blur">
      {tools.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5 border-r pr-1 last:border-r-0">
          {group.map(([Icon, label, active, run]) => (
            <Hint key={label} label={label}>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={label} aria-pressed={active} onClick={run} className={cn(active && "bg-accent text-brand")}>
                <Icon />
              </Button>
            </Hint>
          ))}
        </div>
      ))}
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => { onImage([...(e.target.files ?? [])]); e.target.value = ""; }} />
      <LinkDialog open={linkOpen} onOpenChange={setLinkOpen} onSubmit={(href) => c().extendMarkRange("link").setLink({ href }).run()} />
    </div>
  );
}

function LinkDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (href: string) => void }) {
  const [url, setUrl] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const href = /^[a-z]+:/i.test(url) || url.startsWith("/") ? url : `https://${url}`;
    if (!SAFE_URL.test(href)) return toast.error("Use um endereço http(s) ou mailto");
    onSubmit(href);
    setUrl("");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader><DialogTitle>Inserir link</DialogTitle></DialogHeader>
          <Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Endereço do link" />
          <DialogFooter><Button type="submit" variant="brand">Inserir</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
