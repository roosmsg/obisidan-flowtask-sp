// The frontmatter property `flowtask` names the Super Productivity project
// that the note's checkboxes belong to. Booleans and their string forms are
// not project names.
export function noteProjectName(frontmatter: Record<string, unknown> | undefined): string | undefined {
  const value = frontmatter?.flowtask;
  if (typeof value !== "string") return undefined;
  const name = value.trim();
  if (!name || ["true", "false"].includes(name.toLocaleLowerCase())) return undefined;
  return name;
}
