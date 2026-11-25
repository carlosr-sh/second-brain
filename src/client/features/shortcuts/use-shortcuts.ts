import { useEffect, useRef } from "react";
import { isMac } from "@/lib/utils";
import { ShortcutEngine, type ShortcutBinding } from "./engine";

/** Registers global keyboard shortcuts on window for the lifetime of the component. */
export function useShortcuts(bindings: ShortcutBinding[]) {
  const engine = useRef<ShortcutEngine | null>(null);
  if (!engine.current) engine.current = new ShortcutEngine(bindings, isMac);
  engine.current.setBindings(bindings);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const fired = engine.current?.handle(e);
      if (fired && fired !== "__sequence_started") e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
