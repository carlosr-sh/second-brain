/**
 * Keyboard shortcut engine (framework-agnostic, unit-tested).
 *
 * Binding syntax:
 *   "mod+k"  → ⌘K on macOS, Ctrl+K elsewhere
 *   "c"      → plain key (ignored while typing in a field)
 *   "g d"    → sequence: G, then D within SEQUENCE_TIMEOUT_MS
 *   "?" "["  → symbols (Shift state ignored, since layouts differ)
 */
export interface ShortcutBinding {
  id: string;
  keys: string;
  run: () => void;
  /** Fire even when focus is in an input/textarea/contenteditable. */
  allowInInputs?: boolean;
}

export interface KeyEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
  repeat?: boolean;
  isComposing?: boolean;
}

interface Combo {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

export const SEQUENCE_TIMEOUT_MS = 1200;

export function parseCombo(spec: string): Combo {
  const parts = spec.toLowerCase().split("+");
  const key = parts.pop() ?? "";
  return { key, mod: parts.includes("mod"), shift: parts.includes("shift"), alt: parts.includes("alt") };
}

const isLetterOrDigit = (k: string) => /^[a-z0-9]$/.test(k);

export function matchesCombo(e: KeyEventLike, combo: Combo, mac: boolean): boolean {
  if (e.key.toLowerCase() !== combo.key) return false;
  const modPressed = mac ? e.metaKey : e.ctrlKey;
  const otherMod = mac ? e.ctrlKey : e.metaKey;
  if (combo.mod !== modPressed || otherMod) return false;
  if (combo.alt !== e.altKey) return false;
  // Shift matters for letters/digits; symbols like "?" already imply it.
  if (isLetterOrDigit(combo.key) && combo.shift !== e.shiftKey) return false;
  return true;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== "string") return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  const editable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
  if (!editable) return false;
  // A field inside a dialog that is playing its exit animation still holds
  // focus for ~200ms; the user is no longer typing there.
  return typeof el.closest !== "function" || el.closest('[data-state="closed"]') === null;
}

export class ShortcutEngine {
  private pending: { prefix: string; at: number } | null = null;

  constructor(
    private bindings: ShortcutBinding[],
    private readonly mac: boolean,
    private readonly now: () => number = () => Date.now(),
  ) {}

  setBindings(bindings: ShortcutBinding[]) {
    this.bindings = bindings;
  }

  /** Returns the id of the binding that fired (caller should preventDefault), or null. */
  handle(e: KeyEventLike): string | null {
    if (e.isComposing || e.repeat) return null;
    const typing = isEditableTarget(e.target);
    const t = this.now();

    // 1) Complete a pending sequence ("g" then "d").
    if (this.pending && t - this.pending.at <= SEQUENCE_TIMEOUT_MS && !typing) {
      const prefix = this.pending.prefix;
      this.pending = null;
      for (const b of this.bindings) {
        const steps = b.keys.split(" ");
        if (steps.length === 2 && steps[0] === prefix && matchesCombo(e, parseCombo(steps[1] ?? ""), this.mac)) {
          b.run();
          return b.id;
        }
      }
      return null;
    }
    this.pending = null;

    // 2) Single combos.
    for (const b of this.bindings) {
      if (b.keys.includes(" ")) continue;
      if (typing && !b.allowInInputs) continue;
      if (matchesCombo(e, parseCombo(b.keys), this.mac)) {
        b.run();
        return b.id;
      }
    }

    // 3) Start a sequence if some binding begins with this key.
    if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const key = e.key.toLowerCase();
      if (this.bindings.some((b) => b.keys.split(" ").length === 2 && b.keys.startsWith(`${key} `))) {
        this.pending = { prefix: key, at: t };
        return "__sequence_started";
      }
    }
    return null;
  }
}

/** Human-readable key caps for display: "mod+k" → ["⌘", "K"]. */
export function formatKeys(spec: string, mac: boolean): string[][] {
  return spec.split(" ").map((step) =>
    step.split("+").map((part) => {
      if (part === "mod") return mac ? "⌘" : "Ctrl";
      if (part === "shift") return mac ? "⇧" : "Shift";
      if (part === "alt") return mac ? "⌥" : "Alt";
      if (part === "enter") return "Enter";
      return part.length === 1 ? part.toUpperCase() : part;
    }),
  );
}
