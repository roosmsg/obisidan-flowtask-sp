import { describe, expect, it } from "vitest";
import { cleanHeadingText, fallbackHeadingTag, headingTagCandidates, nearestHeadings, resolveHeadingTag } from "../src/domain/heading";

const tags = [
  { id: "t1", name: "Garden" },
  { id: "t2", name: "Admin" },
  { id: "t3", name: "Release notes" },
];

describe("nearest heading per line", () => {
  it("returns the closest heading above each line", () => {
    const lines = ["- [ ] no heading", "# Top", "- [ ] a", "## Garden", "- [ ] b", "text", "### Admin", "- [ ] c"];
    expect(nearestHeadings(lines)).toEqual([undefined, "Top", "Top", "Garden", "Garden", "Garden", "Admin", "Admin"]);
  });

  it("ignores frontmatter comments and headings inside code fences", () => {
    const lines = ["---", "# not a heading", "flowtask: true", "---", "- [ ] a", "```md", "# in code", "```", "- [ ] b", "# Real", "- [ ] c"];
    expect(nearestHeadings(lines)).toEqual([undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, "Real", "Real"]);
  });

  it("does not treat hash tags without a space as headings", () => {
    expect(nearestHeadings(["#tag", "- [ ] a"])).toEqual([undefined, undefined]);
  });
});

describe("heading cleanup", () => {
  it("strips formatting, links and closing hashes", () => {
    expect(cleanHeadingText("**Garden** ##")).toBe("Garden");
    expect(cleanHeadingText("[[Projects/Garden|Garden]] tasks")).toBe("Garden tasks");
    expect(cleanHeadingText("[[Garden#Spring]]")).toBe("Garden");
    expect(cleanHeadingText("[Garden](https://example.com) `code` <b>x</b> ==hl== ~~old~~")).toBe("Garden code x hl old");
    expect(cleanHeadingText("_Admin_ snake_case")).toBe("Admin snake_case");
  });

  it("offers a shortened candidate for long headings", () => {
    expect(headingTagCandidates("Garden: spring")).toEqual(["Garden: spring", "Garden"]);
    expect(headingTagCandidates("Garden - spring")).toEqual(["Garden - spring", "Garden"]);
    expect(headingTagCandidates("Garden | spring")).toEqual(["Garden | spring", "Garden"]);
    expect(headingTagCandidates("Garden (2026)")).toEqual(["Garden (2026)", "Garden"]);
    expect(headingTagCandidates("Garden")).toEqual(["Garden"]);
    expect(headingTagCandidates("")).toEqual([]);
  });
});

describe("heading tag resolution", () => {
  it("matches existing tags case-insensitively", () => {
    expect(resolveHeadingTag("## garden", tags)?.id).toBe("t1");
    expect(resolveHeadingTag("RELEASE NOTES", tags)?.id).toBe("t3");
  });

  it("falls back to the shortened heading", () => {
    expect(resolveHeadingTag("Garden: spring", tags)?.id).toBe("t1");
    expect(resolveHeadingTag("Admin - 2026", tags)?.id).toBe("t2");
  });

  it("falls back to a hashtag-safe heading when no tag exists", () => {
    expect(fallbackHeadingTag("Kitchen")).toBe("Kitchen");
    expect(fallbackHeadingTag("Garden: spring tasks")).toBe("Garden");
    expect(fallbackHeadingTag("**Release notes**")).toBe("Release-notes");
    expect(fallbackHeadingTag("   ")).toBeUndefined();
  });

  it("returns nothing when no tag exists", () => {
    expect(resolveHeadingTag("Kitchen", tags)).toBeUndefined();
    expect(resolveHeadingTag(undefined, tags)).toBeUndefined();
    expect(resolveHeadingTag("Garden", [])).toBeUndefined();
  });
});
