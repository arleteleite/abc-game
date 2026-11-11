import { describe, expect, it } from "vitest";
import { formatSeconds } from "./formatSeconds";

describe("formatSeconds", () => {
  it("usa vírgula e uma casa decimal", () => {
    expect(formatSeconds(12_345)).toBe("12,3 s");
    expect(formatSeconds(0)).toBe("0,0 s");
    expect(formatSeconds(60_000)).toBe("60,0 s");
  });
});
