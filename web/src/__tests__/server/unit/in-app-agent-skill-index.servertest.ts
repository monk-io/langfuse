import { describe, expect, it } from "vitest";

import type { LangfuseSkillIndexData } from "@/src/ee/features/in-app-agent/server/skills";
import {
  readLangfuseSkillIndex,
  searchLangfuseSkillIndex,
} from "@/src/ee/features/in-app-agent/server/skills";

const fixtureIndex = {
  skills: [
    {
      id: "instrumentation",
      path: "instrumentation.md",
      title: "Instrumentation",
      content: "# Instrumentation\n\nTrace SDK setup and spans.",
    },
    {
      id: "judge-calibration",
      path: "judge-calibration.md",
      title: "Judge Calibration",
      content:
        "# Judge Calibration\n\nCalibrate evaluator judges with examples.",
    },
  ],
  chunks: [
    {
      id: "instrumentation-1",
      skillId: "instrumentation",
      path: "instrumentation.md",
      title: "Instrumentation",
      heading: "Trace setup",
      index: 0,
      startLine: 1,
      endLine: 2,
      content: "Trace SDK setup and spans.",
      terms: { trace: 2, sdk: 1, setup: 1, spans: 1 },
      length: 5,
    },
    {
      id: "judge-calibration-1",
      skillId: "judge-calibration",
      path: "judge-calibration.md",
      title: "Judge Calibration",
      heading: "Calibration",
      index: 0,
      startLine: 1,
      endLine: 2,
      content: "Calibrate evaluator judges with examples.",
      terms: { calibrate: 1, evaluator: 1, judges: 1, examples: 1 },
      length: 4,
    },
  ],
  search: {
    averageDocumentLength: 4.5,
    idf: {
      trace: 0.6931471805599453,
      sdk: 0.6931471805599453,
      calibrate: 0.6931471805599453,
    },
  },
} satisfies LangfuseSkillIndexData;

describe("Langfuse skill index", () => {
  it("ranks matching chunks with snippets and metadata", () => {
    expect(
      searchLangfuseSkillIndex({ query: "trace setup", index: fixtureIndex }),
    ).toMatchObject([
      {
        skillId: "instrumentation",
        path: "instrumentation.md",
        title: "Instrumentation",
        heading: "Trace setup",
        snippet: "Trace SDK setup and spans.",
      },
    ]);
  });

  it("reads embedded skills", () => {
    expect(
      readLangfuseSkillIndex({
        path: "instrumentation.md",
        index: fixtureIndex,
      }),
    ).toMatchObject({ id: "instrumentation", title: "Instrumentation" });
    expect(() =>
      readLangfuseSkillIndex({ path: "ci-cd.md", index: fixtureIndex }),
    ).toThrow("Skill not found.");
  });
});
