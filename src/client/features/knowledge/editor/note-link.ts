import { mergeAttributes, Node, ReactRenderer } from "@tiptap/react";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { NoteLinkMenu, type NoteLinkItem, type NoteLinkMenuHandle } from "./note-link-menu";

export interface NoteLinkOptions {
  /** Search notes for the suggestion list. */
  search: (query: string) => Promise<NoteLinkItem[]>;
  /** Create a note named `label`, return its reference. */
  create: (label: string) => Promise<NoteLinkItem>;
  /** Note being edited (excluded from suggestions: no self links). */
  currentNoteId?: string;
}

/**
 * Inline, atomic link to another note: stores the target id (not the title),
 * so renaming the target never breaks the link. Typed with "[[".
 */
export const NoteLink = Node.create<NoteLinkOptions>({
  name: "noteLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { search: async () => [], create: async (label) => ({ id: "", label }), currentNoteId: undefined };
  },

  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute("data-note-id") },
      label: { default: "", parseHTML: (el) => el.textContent ?? "" },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-note-link]" }];
  },

  renderHTML({ node }) {
    return ["a", mergeAttributes({ "data-note-link": "", "data-note-id": node.attrs.id, href: `/notes/${node.attrs.id}`, class: "note-link" }), node.attrs.label || "nota"];
  },

  renderText({ node }) {
    return `[[${node.attrs.label}]]`;
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      Suggestion<NoteLinkItem>({
        editor: this.editor,
        char: "[[",
        allowSpaces: true,
        pluginKey: new PluginKey("noteLinkSuggestion"),
        items: async ({ query }) => {
          const found = (await options.search(query)).filter((n) => n.id !== options.currentNoteId).slice(0, 7);
          const exact = found.some((n) => n.label.toLowerCase() === query.trim().toLowerCase());
          return query.trim() && !exact ? [...found, { id: "", label: query.trim(), create: true }] : found;
        },
        command: ({ editor, range, props }) => {
          const insert = (item: NoteLinkItem) =>
            editor.chain().focus().insertContentAt(range, [{ type: "noteLink", attrs: { id: item.id, label: item.label } }, { type: "text", text: " " }]).run();
          if (props.create) void options.create(props.label).then(insert);
          else insert(props);
        },
        render: () => {
          let renderer: ReactRenderer<NoteLinkMenuHandle> | null = null;
          let popup: HTMLDivElement | null = null;
          const place = (props: SuggestionProps<NoteLinkItem>) => {
            const rect = props.clientRect?.();
            if (!rect || !popup) return;
            popup.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
            popup.style.top = `${rect.bottom + 6}px`;
          };
          return {
            onStart: (props) => {
              renderer = new ReactRenderer(NoteLinkMenu, { props, editor: props.editor });
              popup = document.createElement("div");
              popup.className = "fixed z-50";
              popup.appendChild(renderer.element);
              document.body.appendChild(popup);
              place(props);
            },
            onUpdate: (props) => {
              renderer?.updateProps(props);
              place(props);
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === "Escape") {
                popup?.remove();
                return true;
              }
              return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              popup?.remove();
              renderer?.destroy();
              popup = null;
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
