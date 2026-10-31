import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, formatDate, formatMonth, monthsBetween, previousMonthKey } from "./dates";

describe("dates", () => {
  it("adds months with month-end clamping", () => {
    expect(addMonths("2026-10-30", 12)).toBe("2027-10-30");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-15", -3)).toBe("2025-12-15");
  });

  it("counts whole months between dates", () => {
    expect(monthsBetween("2026-10-30", "2027-10-30")).toBe(12);
    expect(monthsBetween("2026-10-30", "2027-10-29")).toBe(11);
    expect(monthsBetween("2026-01-31", "2026-02-28")).toBe(1);
    expect(monthsBetween("2026-10-30", "2026-01-01")).toBe(0);
  });

  it("does day maths across months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(daysBetween("2026-10-28", "2026-11-01")).toBe(4);
    expect(daysBetween("2026-11-01", "2026-10-28")).toBe(-4);
  });

  it("formats dates the PRD way", () => {
    expect(formatDate("2026-10-29")).toBe("29 Oct 2026");
    expect(formatMonth("2026-10")).toBe("Oct 2026");
    expect(previousMonthKey("2026-01-15")).toBe("2025-12");
  });
});
