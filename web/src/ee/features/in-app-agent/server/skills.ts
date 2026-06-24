import { LANGFUSE_SKILL_INDEX } from "./skillIndex.generated";
import { scoreBm25Document, tokenizeBm25Text } from "@/src/utils/bm25";

// Note:
// The embedded assistant content currently indexes the reference files from
// the skills submodule, not the submodule's skill definitions.
// This will change in the future as the skills repo is reorganized.

const DEFAULT_SEARCH_LIMIT = 5;
const MAX_SEARCH_LIMIT = 10;
const SNIPPET_LENGTH = 360;
const MAX_SKILL_CONTENT_LENGTH = 24_000;

export type LangfuseSkill = {
  id: string;
  path: string;
  title: string;
  content: string;
};

export type LangfuseSkillIndexSourceData = {
  skills: LangfuseSkill[];
};

type MarkdownChunk = {
  heading: string;
  startLine: number;
  endLine: number;
  content: string;
};

export type LangfuseSkillChunk = {
  id: string;
  skillId: string;
  path: string;
  title: string;
  heading: string;
  index: number;
  startLine: number;
  endLine: number;
  content: string;
  terms: Record<string, number>;
  length: number;
};

export type LangfuseSkillIndexData = {
  skills: LangfuseSkill[];
  chunks: LangfuseSkillChunk[];
  search: {
    averageDocumentLength: number;
    idf: Record<string, number>;
  };
};

const DEFAULT_LANGFUSE_SKILL_INDEX =
  buildLangfuseSkillIndex(LANGFUSE_SKILL_INDEX);

export function searchLangfuseSkillIndex({
  query,
  limit = DEFAULT_SEARCH_LIMIT,
  index = DEFAULT_LANGFUSE_SKILL_INDEX,
}: {
  query: string;
  limit?: number;
  index?: LangfuseSkillIndexData;
}) {
  const queryTerms = [...new Set(tokenizeBm25Text(query))];
  if (queryTerms.length === 0) {
    return [];
  }

  return index.chunks
    .map((chunk) => ({
      chunk,
      score: scoreBm25Document({
        document: chunk,
        queryTerms,
        index: index.search,
      }),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(Math.max(1, limit), MAX_SEARCH_LIMIT))
    .map(({ chunk, score }) => ({
      skillId: chunk.skillId,
      path: chunk.path,
      title: chunk.title,
      heading: chunk.heading,
      score: Number(score.toFixed(4)),
      snippet: getSnippet(chunk.content, queryTerms),
    }));
}

export function readLangfuseSkillIndex({
  id,
  path: skillPath,
  index = DEFAULT_LANGFUSE_SKILL_INDEX,
}: {
  id?: string;
  path?: string;
  index?: LangfuseSkillIndexData;
}) {
  if (!id && !skillPath) {
    throw new Error("Provide either skill id or path.");
  }

  const skill = index.skills.find(
    (item) => item.id === id || item.path === skillPath,
  );
  if (!skill) {
    throw new Error("Skill not found.");
  }

  return {
    id: skill.id,
    path: skill.path,
    title: skill.title,
    content: skill.content.slice(0, MAX_SKILL_CONTENT_LENGTH),
    truncated: skill.content.length > MAX_SKILL_CONTENT_LENGTH,
  };
}

function getSnippet(content: string, queryTerms: string[]) {
  const lowerContent = content.toLowerCase();
  const matchIndex = queryTerms.reduce((bestIndex, term) => {
    const index = lowerContent.indexOf(term);
    if (index === -1) {
      return bestIndex;
    }
    return bestIndex === -1 ? index : Math.min(bestIndex, index);
  }, -1);
  const start = matchIndex === -1 ? 0 : Math.max(0, matchIndex - 120);
  const snippet = content.slice(start, start + SNIPPET_LENGTH).trim();

  return `${start > 0 ? "..." : ""}${snippet}${
    start + SNIPPET_LENGTH < content.length ? "..." : ""
  }`;
}

function buildLangfuseSkillIndex(
  source: LangfuseSkillIndexSourceData,
): LangfuseSkillIndexData {
  const chunks = source.skills.flatMap((skill) =>
    splitMarkdown(skill.content).map((chunk, index) => {
      const tokens = tokenizeBm25Text(
        `${skill.title} ${chunk.heading} ${chunk.content}`,
      );

      return {
        id: `${skill.id}-${index + 1}`,
        skillId: skill.id,
        path: skill.path,
        title: skill.title,
        heading: chunk.heading,
        index,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        terms: termCounts(tokens),
        length: tokens.length,
      } satisfies LangfuseSkillChunk;
    }),
  );

  const documentFrequency: Record<string, number> = {};
  for (const chunk of chunks) {
    for (const term of Object.keys(chunk.terms)) {
      documentFrequency[term] = (documentFrequency[term] ?? 0) + 1;
    }
  }

  const documentCount = chunks.length || 1;
  const idf = Object.fromEntries(
    Object.entries(documentFrequency).map(([term, frequency]) => [
      term,
      Math.log(1 + (documentCount - frequency + 0.5) / (frequency + 0.5)),
    ]),
  );
  const averageDocumentLength =
    chunks.reduce((sum, chunk) => sum + chunk.length, 0) / documentCount;

  return {
    skills: source.skills,
    chunks,
    search: { averageDocumentLength, idf },
  };
}

function splitMarkdown(content: string): MarkdownChunk[] {
  const lines = content.split("\n");
  const chunks: MarkdownChunk[] = [];
  let startLine = 1;
  let heading = "Overview";
  let current: string[] = [];

  const flush = (endLine: number) => {
    const text = current.join("\n").trim();
    if (text) {
      chunks.push({ heading, startLine, endLine, content: text });
    }
  };

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match && current.length > 0) {
      flush(index);
      current = [];
      startLine = index + 1;
      heading = match[2]?.trim() ?? heading;
    } else if (match) {
      heading = match[2]?.trim() ?? heading;
      startLine = index + 1;
    }
    current.push(line);
  });

  flush(lines.length);
  return chunks;
}

function termCounts(tokens: string[]): Record<string, number> {
  return tokens.reduce<Record<string, number>>((counts, token) => {
    counts[token] = (counts[token] ?? 0) + 1;
    return counts;
  }, {});
}
