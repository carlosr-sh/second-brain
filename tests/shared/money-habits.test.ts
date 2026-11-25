import { describe, expect, it } from "vitest";
import { completionRate, currentStreak, longestStreak, periodStart } from "../../src/shared/habits";
import { formatBRL, parseBRL } from "../../src/shared/money";

describe("parseBRL (string math, no floats)", () => {
  it.each([
    ["1.234,56", 123456], ["1234,56", 123456], ["0,1", 10], ["12,5", 1250], ["R$ 12", 1200], ["12.50", 1250],
    ["1.234", 123400], ["1.234.567,89", 123456789], ["0,07", 7], ["19,90", 1990],
  ])("%s → %d", (input, cents) => expect(parseBRL(input)).toBe(cents));

  it.each(["", "abc", "1,2,3", "12,345", "-5", "1e3", "1.23.4", "12.345,6.7"])("rejects %j", (input) => expect(parseBRL(input)).toBeNull());

  it("avoids float drift (0,1 + 0,2)", () => expect(parseBRL("0,1")! + parseBRL("0,2")!).toBe(30));
  it("formats", () => expect(formatBRL(-123456).replace(/\s/g, " ")).toBe("-R$ 1.234,56"));
});

const logs = (...dates: string[]) => dates.map((date) => ({ date, count: 1 }));

describe("habit streaks", () => {
  it("period starts", () => {
    expect(periodStart("2026-11-27", "weekly")).toBe("2026-11-23");
    expect(periodStart("2026-11-27", "monthly")).toBe("2026-11-01");
  });

  it("daily: today not done yet does not break the streak", () => {
    expect(currentStreak(logs("2026-11-22", "2026-11-23", "2026-11-24"), "daily", 1, "2026-11-25")).toBe(3);
    expect(currentStreak(logs("2026-11-23", "2026-11-24", "2026-11-25"), "daily", 1, "2026-11-25")).toBe(3);
    expect(currentStreak(logs("2026-11-22", "2026-11-23"), "daily", 1, "2026-11-25")).toBe(0); // missed yesterday
  });

  it("weekly with a target of 3 per week", () => {
    const l = logs("2026-11-09", "2026-11-10", "2026-11-11", "2026-11-16", "2026-11-18", "2026-11-20", "2026-11-23");
    expect(currentStreak(l, "weekly", 3, "2026-11-25")).toBe(2); // current week 1/3 doesn't break
    expect(longestStreak(l, "weekly", 3)).toBe(2);
  });

  it("monthly across a year boundary", () => {
    expect(currentStreak(logs("2025-12-05", "2026-01-10"), "monthly", 1, "2026-01-20")).toBe(2);
  });

  it("longest streak and completion rate", () => {
    const l = logs("2026-11-01", "2026-11-02", "2026-11-03", "2026-11-10", "2026-11-11");
    expect(longestStreak(l, "daily", 1)).toBe(3);
    expect(completionRate(l, "daily", 1, "2026-11-25")).toBeCloseTo(5 / 30);
  });

  it("counts above 1 per day for targets > 1", () => {
    expect(currentStreak([{ date: "2026-11-24", count: 2 }, { date: "2026-11-25", count: 1 }], "daily", 2, "2026-11-25")).toBe(1);
  });
});
