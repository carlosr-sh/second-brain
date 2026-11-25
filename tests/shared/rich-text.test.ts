import { describe, expect, it } from "vitest";
import { docFromText, extractFileIds, extractNoteLinkIds, extractText, sanitizeDoc } from "../../src/shared/rich-text";

const NOTE = "0190a0a0-0000-7000-8000-000000000001";
const FILE = "0190a0a0-0000-7000-8000-0000000000f1";
const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const t = (text: string, marks?: unknown[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });

describe("sanitizeDoc", () => {
  it("keeps allowed structure and drops unknown attributes", () => {
    const clean = sanitizeDoc(doc({ type: "heading", attrs: { level: 2, onclick: "x", style: "color:red" }, content: [t("Oi")] }));
    expect(clean.content[0]).toEqual({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Oi" }] });
  });

  it.each([
    ["script-like node", doc({ type: "script", content: [t("x")] })],
    ["raw html node", doc({ type: "html", attrs: { html: "<img onerror=x>" } })],
    ["javascript: link", doc(p(t("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])))],
    ["data: link", doc(p(t("x", [{ type: "link", attrs: { href: "data:text/html,x" } }])))],
    ["protocol-relative link", doc(p(t("x", [{ type: "link", attrs: { href: "//evil.com" } }])))],
    ["external image", doc({ type: "image", attrs: { src: "https://evil.com/track.png" } })],
    ["unknown mark", doc(p(t("x", [{ type: "fontFamily" }])))],
    ["bad note link id", doc(p({ type: "noteLink", attrs: { id: "../../etc" } }))],
    ["non-doc root", p(t("x"))],
    ["__proto__ type", doc({ type: "__proto__" })],
  ])("rejects %s", (_name, input) => {
    expect(() => sanitizeDoc(input)).toThrow();
  });

  it("allows safe links and own images", () => {
    const clean = sanitizeDoc(doc(
      p(t("site", [{ type: "link", attrs: { href: "https://example.com", target: "_blank", rel: "x" } }])),
      { type: "image", attrs: { src: `/api/files/${FILE}`, alt: "foto" } },
    ));
    expect(clean.content[0]?.content?.[0]?.marks).toEqual([{ type: "link", attrs: { href: "https://example.com" } }]);
  });

  it("limits nesting depth", () => {
    let node: unknown = p(t("fundo"));
    for (let i = 0; i < 60; i++) node = { type: "blockquote", content: [node] };
    expect(() => sanitizeDoc(doc(node))).toThrow(/aninhado/);
  });
});

describe("extraction", () => {
  const d = sanitizeDoc(doc(
    { type: "heading", attrs: { level: 1 }, content: [t("Título")] },
    p(t("Veja "), { type: "noteLink", attrs: { id: NOTE.toUpperCase(), label: "Outra nota" } }, t(" e "), { type: "noteLink", attrs: { id: NOTE, label: "Outra nota" } }),
    { type: "image", attrs: { src: `/api/files/${FILE}`, alt: "diagrama" } },
  ));
  it("extracts plain text with link labels", () => {
    expect(extractText(d)).toBe("Título\nVeja Outra nota e Outra nota\ndiagrama");
  });
  it("extracts unique, normalized note links and file ids", () => {
    expect(extractNoteLinkIds(d)).toEqual([NOTE]);
    expect(extractFileIds(d)).toEqual([FILE]);
  });
  it("builds docs from text", () => {
    expect(extractText(docFromText("linha 1\n\nlinha 2"))).toBe("linha 1\n\nlinha 2");
  });
});
