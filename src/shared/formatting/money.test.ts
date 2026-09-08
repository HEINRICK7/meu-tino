import { describe, expect, it } from "vitest";
import { formatMinorAmount } from "./money";

describe("formatMinorAmount", () => {
  it("formats minor units without floating-point drift", () => {
    expect(formatMinorAmount(49750, "BRL")).toContain("497,50");
    expect(formatMinorAmount(6990, "BRL")).toContain("69,90");
  });

  it("returns a safe placeholder for malformed values", () => {
    expect(formatMinorAmount(Number.NaN, "BRL")).toBe("—");
  });
});
