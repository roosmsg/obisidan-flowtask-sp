import { describe, expect, it } from "vitest";
import { findMarkerRanges } from "../src/domain/markers";

describe("marker ranges", () => {
  it("finds current and legacy markers with their exact extent", () => {
    const text = "- [ ] One %%sp-id:abc-123%%\n- [ ] Two <!--sp-id:xyz_9-->\n- [ ] Three";
    const ranges = findMarkerRanges(text);
    expect(ranges.map((r) => text.slice(r.from, r.to))).toEqual(["%%sp-id:abc-123%%", "<!--sp-id:xyz_9-->"]);
  });

  it("ignores other comments and plain text", () => {
    expect(findMarkerRanges("- [ ] Task %%just a comment%% sp-id: not a marker")).toEqual([]);
    expect(findMarkerRanges("")).toEqual([]);
  });

  it("returns ranges in document order", () => {
    const text = "%%sp-id:b%% and %%sp-id:a%%";
    expect(findMarkerRanges(text)).toEqual([{ from: 0, to: 11 }, { from: 16, to: 27 }]);
  });
});
