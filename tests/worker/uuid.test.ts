import { describe, expect, it } from "vitest";
import { UUID_REGEX, uuidv7 } from "../../src/shared/uuid";

describe("uuidv7", () => {
  it("produces RFC 9562 version-7 UUIDs", () => {
    const id = uuidv7();
    expect(id).toMatch(UUID_REGEX);
    expect(id[14]).toBe("7");
    expect(["8", "9", "a", "b"]).toContain(id[19]);
  });

  it("encodes the timestamp so ids sort chronologically", () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a < b).toBe(true);
    expect(a.replace(/-/g, "").slice(0, 12)).toBe((1_700_000_000_000).toString(16).padStart(12, "0"));
  });

  it("is unique across many calls", () => {
    const set = new Set(Array.from({ length: 5000 }, () => uuidv7()));
    expect(set.size).toBe(5000);
  });
});
