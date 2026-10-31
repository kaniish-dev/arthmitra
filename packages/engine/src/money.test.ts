import { describe, expect, it } from "vitest";
import { formatINR, formatRupeesPlain, roundUpTo, toPaise, tryToPaise } from "./money";

describe("toPaise", () => {
  it("reads Indian grouping, rupee signs and decimals", () => {
    expect(toPaise("1,23,456")).toBe(12_345_600);
    expect(toPaise("₹ 2,40,000")).toBe(24_000_000);
    expect(toPaise("Rs. 450.5")).toBe(45_050);
    expect(toPaise("19500.05")).toBe(1_950_005);
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });

  it("rejects text that is not an amount", () => {
    expect(() => toPaise("12a")).toThrow();
    expect(() => toPaise("1.234")).toThrow();
    expect(tryToPaise("")).toBeNull();
  });
});

describe("formatINR", () => {
  it("formats en-IN with optional paise", () => {
    expect(formatINR(12_345_600, { decimals: true })).toBe("₹1,23,456.00");
    expect(formatINR(1_950_000)).toBe("₹19,500");
    expect(formatINR(-45_000)).toBe("-₹450");
    expect(formatINR(45_000, { signed: true })).toBe("+₹450");
    expect(formatRupeesPlain(24_000_000)).toBe("2,40,000");
  });
});

describe("roundUpTo", () => {
  it("rounds up to ₹100 and never below zero", () => {
    expect(roundUpTo(1_950_000)).toBe(1_950_000);
    expect(roundUpTo(1_671_429)).toBe(1_680_000);
    expect(roundUpTo(1)).toBe(10_000);
    expect(roundUpTo(0)).toBe(0);
    expect(roundUpTo(-500)).toBe(0);
  });
});
