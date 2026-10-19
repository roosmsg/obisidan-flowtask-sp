import { describe, expect, it } from "vitest";
import { hasImportTag, importTagAccepts } from "../src/watcher";

describe("import tag matching", () => {
  it("requires the configured tag when one is set", () => {
    expect(importTagAccepts(["sp"], "sp")).toBe(true);
    expect(importTagAccepts(["SP"], "#sp")).toBe(true);
    expect(importTagAccepts(["work"], "sp")).toBe(false);
    expect(importTagAccepts([], "sp")).toBe(false);
  });

  it("accepts every checkbox when the import tag is empty", () => {
    expect(importTagAccepts([], "")).toBe(true);
    expect(importTagAccepts(["work"], "")).toBe(true);
    expect(importTagAccepts([], "  #  ")).toBe(true);
  });

  it("keeps the strict matcher unchanged for an empty tag", () => {
    expect(hasImportTag([], "")).toBe(false);
  });
});
