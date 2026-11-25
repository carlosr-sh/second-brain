import { describe, expect, it } from "vitest";
import { addMonths, isValidIsoDate, isoWeekday } from "../../src/shared/dates";
import { describeRule, nextOccurrence, parseRule, recurrenceRuleSchema } from "../../src/shared/recurrence";

const next = (from: string, rule: string) => nextOccurrence(from, parseRule(rule)!);

describe("dates", () => {
  it("validates real calendar dates", () => {
    expect(isValidIsoDate("2028-02-29")).toBe(true); // leap year
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
  });
  it("clamps month arithmetic to the month end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("uses ISO weekdays (Mon=0)", () => {
    expect(isoWeekday("2026-11-23")).toBe(0); // Monday
    expect(isoWeekday("2026-11-29")).toBe(6); // Sunday
  });
});

describe("parseRule", () => {
  it("parses and canonicalizes", () => {
    expect(parseRule("freq=weekly;byday=fr,mo")).toEqual({ freq: "WEEKLY", interval: 1, byDay: ["MO", "FR"] });
    expect(recurrenceRuleSchema.parse("FREQ=WEEKLY;BYDAY=FR,MO;INTERVAL=1")).toBe("FREQ=WEEKLY;BYDAY=MO,FR");
  });
  it.each(["", "FREQ=HOURLY", "FREQ=DAILY;INTERVAL=0", "FREQ=DAILY;BYDAY=MO", "FREQ=WEEKLY;BYDAY=XX", "FREQ=DAILY;COUNT=3", "FREQ=DAILY;FREQ=WEEKLY", "FREQ=DAILY;INTERVAL=1e3"])(
    "rejects %j",
    (rule) => expect(parseRule(rule)).toBeNull(),
  );
});

describe("nextOccurrence", () => {
  it("daily / interval", () => {
    expect(next("2026-11-25", "FREQ=DAILY")).toBe("2026-11-26");
    expect(next("2026-11-30", "FREQ=DAILY;INTERVAL=3")).toBe("2026-12-03");
  });
  it("weekly without BYDAY keeps the weekday", () => {
    expect(next("2026-11-25", "FREQ=WEEKLY")).toBe("2026-12-02");
    expect(next("2026-11-25", "FREQ=WEEKLY;INTERVAL=2")).toBe("2026-12-09");
  });
  it("weekdays skip the weekend", () => {
    expect(next("2026-11-27", "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")).toBe("2026-11-30"); // Fri → Mon
    expect(next("2026-11-25", "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")).toBe("2026-11-26");
  });
  it("biweekly BYDAY skips the off week", () => {
    // From Wed 2026-11-25 (week of Nov 23): next Monday in an "on" week is Dec 7.
    expect(next("2026-11-25", "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO")).toBe("2026-12-07");
    expect(next("2026-11-25", "FREQ=WEEKLY;INTERVAL=2;BYDAY=FR")).toBe("2026-11-27"); // same week
  });
  it("monthly and yearly clamp", () => {
    expect(next("2026-01-31", "FREQ=MONTHLY")).toBe("2026-02-28");
    expect(next("2028-02-29", "FREQ=YEARLY")).toBe("2029-02-28");
  });
});

it("describes rules in Portuguese", () => {
  expect(describeRule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")).toBe("Dias úteis");
  expect(describeRule("FREQ=DAILY;INTERVAL=3")).toBe("A cada 3 dia(s)");
  expect(describeRule(null)).toBeNull();
});
