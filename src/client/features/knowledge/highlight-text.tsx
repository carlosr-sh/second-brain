import { HL_END, HL_START } from "@shared/knowledge";

/**
 * Renders FTS snippets with highlights WITHOUT HTML: the server marks matches
 * with control characters; we split on them and wrap matches in <mark>.
 */
export function HighlightText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(new RegExp(`(${HL_START}[^${HL_END}]*${HL_END})`, "g"));
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.startsWith(HL_START) ? <mark key={i} className="rounded-sm bg-brand-soft px-0.5 text-foreground">{p.slice(1, -1)}</mark> : <span key={i}>{p}</span>,
      )}
    </span>
  );
}
