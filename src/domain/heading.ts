import type { TagRef } from "../types";

const HEADING_RE = /^ {0,3}#{1,6}\s+(.*?)\s*$/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
// Long headings are shortened at the first of these separators when the full
// heading does not match a tag, e.g. "Garden: spring tasks" -> "Garden".
const SHORTEN_RE = /\s*(?::|\||\(|\s[-–—]\s).*$/;

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

export function headingTagCandidates(heading: string): string[] {
  const full = cleanHeadingText(heading);
  if (!full) return [];
  const short = full.replace(SHORTEN_RE, "").trim();
  return short && short !== full ? [full, short] : [full];
}

// Tag name for a heading that matches no existing tag. It is appended to the
// title as #tag like an unknown inline tag; spaces become hyphens because a
// hashtag in a title ends at the first space.
export function fallbackHeadingTag(heading: string): string | undefined {
  const candidates = headingTagCandidates(heading);
  const short = candidates[candidates.length - 1];
  return short ? short.replace(/\s+/g, "-") : undefined;
}

// Existing Super Productivity tags are matched case-insensitively.
export function resolveHeadingTag(heading: string | undefined, tags: TagRef[]): TagRef | undefined {
  if (!heading) return undefined;
  for (const candidate of headingTagCandidates(heading)) {
    const normalized = candidate.toLocaleLowerCase();
    const tag = tags.find((item) => item.name.trim().toLocaleLowerCase() === normalized);
    if (tag) return tag;
  }
  return undefined;
}
