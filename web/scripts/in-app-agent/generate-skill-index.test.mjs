import { describe, expect, it } from "vitest";

import { validateWhitelistedPath } from "./generate-skill-index.mjs";

describe("validateWhitelistedPath", () => {
  it("accepts relative Markdown paths", () => {
    expect(validateWhitelistedPath("instrumentation.md").normalizedPath).toBe(
      "instrumentation.md",
    );
  });

  it("rejects unsafe whitelist entries", () => {
    expect(() => validateWhitelistedPath("/tmp/instrumentation.md")).toThrow(
      "must be relative",
    );
    expect(() => validateWhitelistedPath("../instrumentation.md")).toThrow(
      "must not traverse",
    );
    expect(() => validateWhitelistedPath("instrumentation.txt")).toThrow(
      "must be a Markdown file",
    );
  });
});
