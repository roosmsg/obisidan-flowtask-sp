import { describe, expect, it } from "vitest";
import { locateLine } from "../src/domain/lines";

describe("marker line location", () => {
  const original = "- [ ] Update website";

  it("uses the expected index when the line is unchanged", () => {
    expect(locateLine(["# Tasks", original, "- [ ] Other"], 1, original)).toBe(1);
  });

  it("follows the line when lines were inserted or removed above it", () => {
    expect(locateLine(["# Tasks", "", original, "- [ ] Other"], 1, original)).toBe(2);
    expect(locateLine([original, "- [ ] Other"], 1, original)).toBe(0);
  });

  it("prefers the nearest exact match", () => {
    expect(locateLine([original, "x", "y", original], 2, original)).toBe(3);
  });

  it("follows a line the user kept typing on", () => {
    expect(locateLine(["# Tasks", "- [ ] Update website today"], 1, original)).toBe(1);
    expect(locateLine(["- [ ] ", "- [ ] Update website today"], 0, original)).toBe(1);
  });

  it("returns nothing when the line is gone", () => {
    expect(locateLine(["# Tasks", "- [ ] "], 1, original)).toBeUndefined();
    expect(locateLine([], 0, original)).toBeUndefined();
  });
});
