import { z } from "./z";
import { UUID_REGEX } from "./uuid";

/**
 * Rich-text documents (Tiptap/ProseMirror JSON).
 *
 * Security model: we never store or render user HTML. Documents are JSON,
 * validated here against a WHITELIST of node and mark types. Unknown attributes
 * are dropped; URLs are restricted (links: http(s)/mailto/relative; images:
 * only our own uploads). The cleaned document is what gets stored.
 */
export interface RichMark {
  type: string;
  attrs?: Record<string, unknown>;
}
export interface RichNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
}
export interface RichDoc extends RichNode {
  type: "doc";
  content: RichNode[];
}

const MAX_DEPTH = 40;
const MAX_NODES = 50_000;
const MAX_TEXT = 200_000;

export const FILE_SRC_REGEX = /^\/api\/files\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/))/i;

type AttrSanitizer = (a: Record<string, unknown>) => Record<string, unknown> | undefined;

const str = (v: unknown, max = 500): string | null => (typeof v === "string" ? v.slice(0, max) : null);
const int = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fallback;

/** Allowed block/inline nodes → attribute sanitizer (undefined = no attrs). */
const NODES: Record<string, AttrSanitizer | null> = {
  doc: null,
  paragraph: null,
  text: null,
  heading: (a) => ({ level: int(a.level, 1, 6, 2) }),
  bulletList: null,
  orderedList: (a) => ({ start: int(a.start, 0, 1_000_000, 1) }),
  listItem: null,
  taskList: null,
  taskItem: (a) => ({ checked: a.checked === true }),
  blockquote: null,
  codeBlock: (a) => ({ language: str(a.language, 30) }),
  hardBreak: null,
  horizontalRule: null,
  image: (a) => {
    if (typeof a.src !== "string" || !FILE_SRC_REGEX.test(a.src)) throw new RichTextError("Imagem com origem não permitida");
    return { src: a.src, alt: str(a.alt, 300), title: str(a.title, 300) };
  },
  noteLink: (a) => {
    if (typeof a.id !== "string" || !UUID_REGEX.test(a.id)) throw new RichTextError("Link de nota inválido");
    return { id: a.id.toLowerCase(), label: str(a.label, 200) ?? "" };
  },
};

const MARKS: Record<string, AttrSanitizer | null> = {
  bold: null,
  italic: null,
  strike: null,
  underline: null,
  code: null,
  highlight: null,
  link: (a) => {
    if (typeof a.href !== "string" || !SAFE_HREF.test(a.href)) throw new RichTextError("Link com protocolo não permitido");
    return { href: a.href.slice(0, 2048) };
  },
};

export class RichTextError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Validates and returns a CLEAN copy of the document (throws RichTextError). */
export function sanitizeDoc(input: unknown): RichDoc {
  let count = 0;
  const walk = (raw: unknown, depth: number): RichNode => {
    if (++count > MAX_NODES) throw new RichTextError("Documento grande demais");
    if (depth > MAX_DEPTH) throw new RichTextError("Documento aninhado demais");
    if (!isObj(raw) || typeof raw.type !== "string") throw new RichTextError("Nó inválido");
    const sanitizer = NODES[raw.type];
    if (sanitizer === undefined || !Object.hasOwn(NODES, raw.type)) throw new RichTextError(`Tipo de nó não permitido: ${raw.type}`);
    const node: RichNode = { type: raw.type };

    if (raw.type === "text") {
      if (typeof raw.text !== "string" || raw.text.length === 0 || raw.text.length > MAX_TEXT) throw new RichTextError("Texto inválido");
      node.text = raw.text;
    }
    if (sanitizer && isObj(raw.attrs ?? {})) node.attrs = sanitizer((raw.attrs ?? {}) as Record<string, unknown>);
    if (raw.marks !== undefined) {
      if (!Array.isArray(raw.marks)) throw new RichTextError("Marcas inválidas");
      node.marks = raw.marks.map((m) => {
        if (!isObj(m) || typeof m.type !== "string" || !Object.hasOwn(MARKS, m.type)) throw new RichTextError("Marca não permitida");
        const ms = MARKS[m.type];
        const mark: RichMark = { type: m.type };
        if (ms) mark.attrs = ms(isObj(m.attrs) ? m.attrs : {});
        return mark;
      });
    }
    if (raw.content !== undefined) {
      if (!Array.isArray(raw.content)) throw new RichTextError("Conteúdo inválido");
      node.content = raw.content.map((c) => walk(c, depth + 1));
    }
    return node;
  };
  const doc = walk(input, 0);
  if (doc.type !== "doc") throw new RichTextError("A raiz deve ser 'doc'");
  return { ...doc, type: "doc", content: doc.content ?? [] };
}

export const richDocSchema = z.unknown().transform((v, ctx) => {
  try {
    return sanitizeDoc(v);
  } catch (e) {
    ctx.addIssue({ code: "custom", message: e instanceof RichTextError ? e.message : "Documento inválido" });
    return z.NEVER;
  }
});

const BLOCKS = new Set(["paragraph", "heading", "listItem", "taskItem", "blockquote", "codeBlock", "horizontalRule"]);

/** Plain text for search, previews and Markdown-free export. */
export function extractText(doc: RichNode): string {
  const parts: string[] = [];
  const walk = (n: RichNode) => {
    if (n.type === "text") parts.push(n.text ?? "");
    else if (n.type === "noteLink") parts.push(String(n.attrs?.label ?? ""));
    else if (n.type === "image") parts.push(String(n.attrs?.alt ?? ""));
    else if (n.type === "hardBreak") parts.push("\n");
    n.content?.forEach(walk);
    if (BLOCKS.has(n.type)) parts.push("\n");
  };
  walk(doc);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function collect(doc: RichNode, type: string, pick: (n: RichNode) => string | undefined): string[] {
  const out = new Set<string>();
  const walk = (n: RichNode) => {
    if (n.type === type) {
      const v = pick(n);
      if (v) out.add(v);
    }
    n.content?.forEach(walk);
  };
  walk(doc);
  return [...out];
}

export const extractNoteLinkIds = (doc: RichNode) => collect(doc, "noteLink", (n) => n.attrs?.id as string | undefined);
export const extractFileIds = (doc: RichNode) =>
  collect(doc, "image", (n) => (typeof n.attrs?.src === "string" ? n.attrs.src.split("/").pop() : undefined));

export const emptyDoc = (): RichDoc => ({ type: "doc", content: [] });

/** Builds a doc from plain text (one paragraph per line) — used by inbox → note. */
export function docFromText(text: string): RichDoc {
  return {
    type: "doc",
    content: text.split("\n").map((line) => (line ? { type: "paragraph", content: [{ type: "text", text: line }] } : { type: "paragraph" })),
  };
}
