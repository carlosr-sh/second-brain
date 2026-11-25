import { describe, expect, it, vi } from "vitest";
import { formatKeys, isEditableTarget, matchesCombo, parseCombo, SEQUENCE_TIMEOUT_MS, ShortcutEngine, type KeyEventLike } from "@/features/shortcuts/engine";

const key = (k: string, extra: Partial<KeyEventLike> = {}): KeyEventLike => ({
  key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, target: document.body, ...extra,
});

describe("matchesCombo", () => {
  it("maps mod to ⌘ on macOS and Ctrl elsewhere", () => {
    const combo = parseCombo("mod+k");
    expect(matchesCombo(key("k", { metaKey: true }), combo, true)).toBe(true);
    expect(matchesCombo(key("k", { ctrlKey: true }), combo, true)).toBe(false);
    expect(matchesCombo(key("k", { ctrlKey: true }), combo, false)).toBe(true);
    expect(matchesCombo(key("k"), combo, false)).toBe(false);
  });

  it("plain letters do not fire with modifiers or Shift", () => {
    const c = parseCombo("c");
    expect(matchesCombo(key("c"), c, false)).toBe(true);
    expect(matchesCombo(key("C", { shiftKey: true }), c, false)).toBe(false);
    expect(matchesCombo(key("c", { ctrlKey: true }), c, false)).toBe(false);
  });

  it("symbols ignore Shift (needed to type '?')", () => {
    expect(matchesCombo(key("?", { shiftKey: true }), parseCombo("?"), false)).toBe(true);
  });
});

describe("isEditableTarget", () => {
  it("detects inputs, textareas and contenteditable", () => {
    const input = document.createElement("input");
    const div = document.createElement("div");
    div.contentEditable = "true";
    document.body.append(input, div);
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it("ignores fields inside a dialog that is closing (regression)", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("data-state", "closed");
    const input = document.createElement("input");
    dialog.append(input);
    document.body.append(dialog);
    expect(isEditableTarget(input)).toBe(false);
  });
});

describe("ShortcutEngine", () => {
  const setup = (now = { t: 0 }) => {
    const calls: string[] = [];
    const engine = new ShortcutEngine(
      [
        { id: "palette", keys: "mod+k", allowInInputs: true, run: () => calls.push("palette") },
        { id: "capture", keys: "c", run: () => calls.push("capture") },
        { id: "go-inbox", keys: "g i", run: () => calls.push("go-inbox") },
      ],
      false,
      () => now.t,
    );
    return { engine, calls, now };
  };

  it("fires single-key shortcuts", () => {
    const { engine, calls } = setup();
    expect(engine.handle(key("c"))).toBe("capture");
    expect(calls).toEqual(["capture"]);
  });

  it("does not fire plain shortcuts while typing, but allows opted-in ones", () => {
    const { engine, calls } = setup();
    const input = document.createElement("input");
    document.body.append(input);
    expect(engine.handle(key("c", { target: input }))).toBeNull();
    expect(engine.handle(key("k", { target: input, ctrlKey: true }))).toBe("palette");
    expect(calls).toEqual(["palette"]);
  });

  it("handles sequences within the timeout", () => {
    const { engine, calls, now } = setup();
    expect(engine.handle(key("g"))).toBe("__sequence_started");
    now.t += 300;
    expect(engine.handle(key("i"))).toBe("go-inbox");
    expect(calls).toEqual(["go-inbox"]);
  });

  it("expires sequences after the timeout", () => {
    const { engine, calls, now } = setup();
    engine.handle(key("g"));
    now.t += SEQUENCE_TIMEOUT_MS + 1;
    expect(engine.handle(key("i"))).toBeNull();
    expect(calls).toEqual([]);
  });

  it("ignores key repeat and IME composition", () => {
    const { engine } = setup();
    expect(engine.handle(key("c", { repeat: true }))).toBeNull();
    expect(engine.handle(key("c", { isComposing: true }))).toBeNull();
  });

  it("uses the latest bindings after setBindings", () => {
    const { engine } = setup();
    const run = vi.fn();
    engine.setBindings([{ id: "x", keys: "x", run }]);
    engine.handle(key("x"));
    expect(run).toHaveBeenCalledOnce();
  });
});

it("formats key caps per platform", () => {
  expect(formatKeys("mod+k", true)).toEqual([["⌘", "K"]]);
  expect(formatKeys("mod+k", false)).toEqual([["Ctrl", "K"]]);
  expect(formatKeys("g i", false)).toEqual([["G"], ["I"]]);
});
