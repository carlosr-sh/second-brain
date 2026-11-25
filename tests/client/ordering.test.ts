import { describe, expect, it } from "vitest";
import { positionBetween, positionInOrder } from "@/features/para/ordering";

describe("fractional ordering", () => {
  it("positions between neighbors", () => {
    expect(positionBetween(undefined, undefined)).toBe(1);
    expect(positionBetween(undefined, 5)).toBe(4);
    expect(positionBetween(5, undefined)).toBe(6);
    expect(positionBetween(1, 2)).toBe(1.5);
  });

  const pos: Record<string, number> = { a: 1, b: 2, c: 3, x: 10 };
  const of = (id: string) => pos[id] as number;

  it("moving to the top / middle / bottom of a column", () => {
    expect(positionInOrder(["x", "a", "b", "c"], "x", of)).toBe(0);
    expect(positionInOrder(["a", "x", "b", "c"], "x", of)).toBe(1.5);
    expect(positionInOrder(["a", "b", "c", "x"], "x", of)).toBe(4);
  });

  it("dropping into an empty column", () => {
    expect(positionInOrder(["x"], "x", of)).toBe(1);
  });

  it("keeps strict ordering after many inserts at the same spot", () => {
    let lo = 1;
    const hi = 2;
    for (let i = 0; i < 40; i++) {
      const mid = positionBetween(lo, hi);
      expect(mid).toBeGreaterThan(lo);
      expect(mid).toBeLessThan(hi);
      lo = mid;
    }
  });
});
