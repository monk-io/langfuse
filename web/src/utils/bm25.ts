const DEFAULT_TOKEN_PATTERN = /[a-z0-9]+/g;
const DEFAULT_K1 = 1.2;
const DEFAULT_B = 0.75;

export type Bm25Document = {
  terms: Record<string, number>;
  length: number;
};

export type Bm25IndexStats = {
  averageDocumentLength: number;
  idf: Record<string, number>;
};

export function tokenizeBm25Text(
  text: string,
  pattern: RegExp = DEFAULT_TOKEN_PATTERN,
) {
  return text.toLowerCase().match(pattern) ?? [];
}

export function scoreBm25Document({
  document,
  queryTerms,
  index,
  k1 = DEFAULT_K1,
  b = DEFAULT_B,
}: {
  document: Bm25Document;
  queryTerms: string[];
  index: Bm25IndexStats;
  k1?: number;
  b?: number;
}) {
  const averageDocumentLength = index.averageDocumentLength || 1;

  return queryTerms.reduce((score, term) => {
    const termFrequency = document.terms[term] ?? 0;
    if (termFrequency === 0) {
      return score;
    }

    const idf = index.idf[term] ?? 0;
    const denominator =
      termFrequency +
      k1 * (1 - b + b * (document.length / averageDocumentLength));

    return score + idf * ((termFrequency * (k1 + 1)) / denominator);
  }, 0);
}
