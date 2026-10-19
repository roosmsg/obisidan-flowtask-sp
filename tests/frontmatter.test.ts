import { describe, expect, it } from "vitest";
import { noteProjectName } from "../src/domain/frontmatter";

describe("per-note project", () => {
  it("reads the project name from flowtask", () => {
    expect(noteProjectName({ flowtask: "Afstuderen" })).toBe("Afstuderen");
    expect(noteProjectName({ flowtask: "  Work  " })).toBe("Work");
  });

  it("does not treat booleans or empty values as a project", () => {
    expect(noteProjectName({ flowtask: false })).toBeUndefined();
    expect(noteProjectName({ flowtask: true })).toBeUndefined();
    expect(noteProjectName({ flowtask: "false" })).toBeUndefined();
    expect(noteProjectName({ flowtask: "TRUE" })).toBeUndefined();
    expect(noteProjectName({ flowtask: "" })).toBeUndefined();
    expect(noteProjectName({ flowtask: 3 })).toBeUndefined();
    expect(noteProjectName(undefined)).toBeUndefined();
    expect(noteProjectName({ tags: ["sp"] })).toBeUndefined();
  });
});
