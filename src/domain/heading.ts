import type { TagRef } from "../types";

const HEADING_RE = /^ {0,3}#{1,6}\s+(.*?)\s*$/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
// Splits a heading from its explanatory tail: "Week 5: Interviews",
// "Week 5 - Interviews", "Week 5 | Interviews", "Week 5 (draft)". A colon only
// counts when followed by whitespace and a dash only when surrounded by it,
// so "10:30" and "Week 3-4" survive. Follows sp-obsidian's heading rules.
const HEADING_SEPARATOR_RE = /\s*(?::\s|\s[-–—]\s|\||\()/;

export const DEFAULT_HEADING_TAG_MAX_LENGTH = 30;

// Returns, for every line, the text of the nearest heading above it. Lines
// inside frontmatter or before the first heading have no heading. Headings in
// fenced code blocks are ignored.
export function nearestHeadings(lines: string[]): Array<string | undefined> {
  const result: Array<string | undefined> = new Array(lines.length);
  let heading: string | undefined;
  let fence: string | undefined;
  let inFrontmatter = lines[0]?.trim() === "---";
  for (const [index, line] of lines.entries()) {
    if (inFrontmatter) {
      if (index > 0 && /^(---|\.\.\.)\s*$/.test(line)) inFrontmatter = false;
      continue;
    }
    const fenceMatch = line.match(FENCE_RE);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = undefined;
    } else if (!fence) {
      const match = line.match(HEADING_RE);
      if (match) heading = match[1];
    }
    result[index] = heading;
  }
  return result;
}

// Strips Markdown formatting, wikilinks and HTML from a heading.
export function cleanHeadingText(raw: string): string {
  return raw
    .replace(/^\s*#{1,6}\s+/, "")
    .replace(/\s+#+\s*$/, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_match, target: string, alias?: string) => alias ?? target)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__|~~|==)/g, "")
    .replace(/\*/g, "")
    .replace(/(^|\s)_+|_+(?=\s|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Turns a cleaned heading into something short enough to be a tag: the part
// before the first separator, cut to the last whole word that fits in
// maxLength (a single overlong word is cut hard). Returns "" when nothing is
// left.
export function shortenHeading(text: string, maxLength = DEFAULT_HEADING_TAG_MAX_LENGTH): string {
  let out = text.trim();
  const separator = HEADING_SEPARATOR_RE.exec(out);
  if (separator && separator.index > 0) out = out.slice(0, separator.index).trim();
  if (out.length > maxLength) {
    const cut = out.slice(0, maxLength);
    const lastSpace = cut.search(/\s\S*$/);
    out = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
  }
  // Drop dangling punctuation left by a cut ("Week 5," -> "Week 5").
  return out.replace(/[\s,;:.\-–—]+$/, "");
}

// The full heading is tried first so an existing tag such as "Garden: spring"
// still matches; the shortened form follows.
export function headingTagCandidates(heading: string, maxLength = DEFAULT_HEADING_TAG_MAX_LENGTH): string[] {
  const full = cleanHeadingText(heading);
  if (!full) return [];
  const short = shortenHeading(full, maxLength);
  return short && short !== full ? [full, short] : [full];
}

// Tag name for a heading that matches no existing tag. It is appended to the
// title as #tag like an unknown inline tag; spaces become hyphens because a
// hashtag in a title ends at the first space.
export function fallbackHeadingTag(heading: string, maxLength = DEFAULT_HEADING_TAG_MAX_LENGTH): string | undefined {
  const candidates = headingTagCandidates(heading, maxLength);
  const short = candidates[candidates.length - 1];
  return short ? short.replace(/\s+/g, "-") : undefined;
}

// Existing Super Productivity tags are matched case-insensitively.
export function resolveHeadingTag(heading: string | undefined, tags: TagRef[], maxLength = DEFAULT_HEADING_TAG_MAX_LENGTH): TagRef | undefined {
  if (!heading) return undefined;
  for (const candidate of headingTagCandidates(heading, maxLength)) {
    const normalized = candidate.toLocaleLowerCase();
    const tag = tags.find((item) => item.name.trim().toLocaleLowerCase() === normalized);
    if (tag) return tag;
  }
  return undefined;
}
