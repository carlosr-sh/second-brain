import { describe, expect, it } from "vitest";
import { greetingFor, isoDateIn } from "@shared/time";
import { ALL_MODULES, findModuleByPath, NAV_GROUPS } from "@/app/navigation";
import { splitCapture } from "@/features/inbox/quick-capture-dialog";
import { resolveTheme } from "@/features/theme/theme-logic";
import { commandFilter, normalize } from "@/lib/search-filter";

describe("commandFilter", () => {
  it("matches ignoring accents and case", () => {
    expect(normalize("Finanças")).toBe("financas");
    expect(commandFilter("Ir para Finanças", "financas")).toBeGreaterThan(0);
    expect(commandFilter("Ir para Finanças", "FINAN")).toBeGreaterThan(0);
  });

  it("does not fuzzy-match scattered letters (regression: 'escuro' → 'Configurações')", () => {
    expect(commandFilter("Ir para Configurações", "escuro", ["Aparência, sistema e auditoria"])).toBe(0);
    expect(commandFilter("Tema escuro", "escuro")).toBeGreaterThan(0);
  });

  it("ranks prefix > word-prefix > substring", () => {
    const prefix = commandFilter("Tarefas", "tar");
    const word = commandFilter("Ir para Tarefas", "tar");
    const sub = commandFilter("Ir para Metas", "eta");
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(sub);
  });

  it("searches keywords and requires every term", () => {
    expect(commandFilter("Captura rápida", "inbox", ["inbox"])).toBeGreaterThan(0);
    expect(commandFilter("Tema escuro", "tema claro")).toBe(0);
  });
});

describe("time helpers (America/Recife, UTC-3)", () => {
  it("computes the local calendar date, not the UTC one", () => {
    // 01:30 UTC on Nov 26 is still 22:30 on Nov 25 in Recife.
    expect(isoDateIn(new Date("2026-11-26T01:30:00Z"))).toBe("2026-11-25");
  });

  it("greets according to the local hour", () => {
    expect(greetingFor(new Date("2026-11-25T11:00:00Z"))).toBe("Bom dia"); // 08:00
    expect(greetingFor(new Date("2026-11-25T18:00:00Z"))).toBe("Boa tarde"); // 15:00
    expect(greetingFor(new Date("2026-11-25T23:30:00Z"))).toBe("Boa noite"); // 20:30
  });
});

describe("theme", () => {
  it("resolves 'system' using the OS preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });
});

describe("quick capture", () => {
  it("stores a lone http(s) URL as the item link", () => {
    expect(splitCapture("  https://example.com/a  ")).toEqual({ content: "https://example.com/a", url: "https://example.com/a" });
    expect(splitCapture("ler https://example.com")).toEqual({ content: "ler https://example.com" });
    expect(splitCapture("javascript:alert(1)")).toEqual({ content: "javascript:alert(1)" });
  });
});

describe("navigation registry", () => {
  it("covers every module with unique ids, paths and shortcuts", () => {
    const ids = ALL_MODULES.map((m) => m.id);
    const paths = ALL_MODULES.map((m) => m.path);
    const shortcuts = ALL_MODULES.flatMap((m) => (m.shortcut ? [m.shortcut] : []));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
    expect(NAV_GROUPS.flatMap((g) => g.modules).length).toBe(17);
  });

  it("finds the module for nested paths", () => {
    expect(findModuleByPath("/")?.id).toBe("dashboard");
    expect(findModuleByPath("/finance/accounts")?.id).toBe("finance");
    expect(findModuleByPath("/nope")).toBeUndefined();
  });
});
