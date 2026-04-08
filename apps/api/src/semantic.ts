/**
 * Lightweight TF-IDF semantic search engine.
 * Replaces lexical keyword matching with proper term-frequency scoring
 * and cosine similarity. No external dependencies required.
 */

type Document = {
  id: string;
  text: string;
  source: "prompt" | "run";
  meta: Record<string, unknown>;
};

type SearchResult = {
  id: string;
  score: number;
  source: "prompt" | "run";
  meta: Record<string, unknown>;
};

type TermVector = Map<string, number>;

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "it", "as", "be", "was", "are",
  "this", "that", "these", "those", "has", "have", "had", "not", "no",
  "will", "can", "do", "does", "did", "been", "being", "its", "than",
  "so", "up", "out", "if", "about", "into", "just", "also", "more",
  "some", "such", "very", "all", "any", "each", "every", "most"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function buildNgrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join("_"));
  }
  return ngrams;
}

function termFrequency(tokens: string[]): TermVector {
  const tf: TermVector = new Map();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  const max = Math.max(1, ...tf.values());
  for (const [term, count] of tf) {
    tf.set(term, 0.5 + 0.5 * (count / max));
  }
  return tf;
}

function cosineSimilarity(a: TermVector, b: TermVector): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const [term, weightA] of a) {
    const weightB = b.get(term) ?? 0;
    dot += weightA * weightB;
    magA += weightA * weightA;
  }

  for (const weight of b.values()) {
    magB += weight * weight;
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

export class SemanticIndex {
  private documents: Document[] = [];
  private vectors: Map<string, TermVector> = new Map();
  private idf: Map<string, number> = new Map();
  private dirty = true;

  clear(): void {
    this.documents = [];
    this.vectors.clear();
    this.idf.clear();
    this.dirty = true;
  }

  addDocument(doc: Document): void {
    const existing = this.documents.findIndex((d) => d.id === doc.id);
    if (existing >= 0) {
      this.documents[existing] = doc;
    } else {
      this.documents.push(doc);
    }
    this.dirty = true;
  }

  private rebuild(): void {
    if (!this.dirty) return;

    const docFreq = new Map<string, number>();
    const docTokens = new Map<string, string[]>();

    for (const doc of this.documents) {
      const tokens = tokenize(doc.text);
      const bigrams = buildNgrams(tokens, 2);
      const allTerms = [...tokens, ...bigrams];
      docTokens.set(doc.id, allTerms);

      const uniqueTerms = new Set(allTerms);
      for (const term of uniqueTerms) {
        docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
      }
    }

    const n = this.documents.length;
    this.idf.clear();
    for (const [term, df] of docFreq) {
      this.idf.set(term, Math.log((n + 1) / (df + 1)) + 1);
    }

    this.vectors.clear();
    for (const doc of this.documents) {
      const tokens = docTokens.get(doc.id)!;
      const tf = termFrequency(tokens);
      const tfidf: TermVector = new Map();

      for (const [term, tfVal] of tf) {
        tfidf.set(term, tfVal * (this.idf.get(term) ?? 1));
      }

      this.vectors.set(doc.id, tfidf);
    }

    this.dirty = false;
  }

  search(query: string, limit = 10, sourceFilter?: "prompt" | "run"): SearchResult[] {
    this.rebuild();

    const queryTokens = tokenize(query);
    const queryBigrams = buildNgrams(queryTokens, 2);
    const allQueryTerms = [...queryTokens, ...queryBigrams];
    const queryTf = termFrequency(allQueryTerms);

    const queryVector: TermVector = new Map();
    for (const [term, tfVal] of queryTf) {
      queryVector.set(term, tfVal * (this.idf.get(term) ?? 1));
    }

    const results: SearchResult[] = [];
    for (const doc of this.documents) {
      if (sourceFilter && doc.source !== sourceFilter) continue;

      const docVector = this.vectors.get(doc.id);
      if (!docVector) continue;

      const score = cosineSimilarity(queryVector, docVector);
      if (score > 0.01) {
        results.push({
          id: doc.id,
          score: Math.round(score * 1000) / 1000,
          source: doc.source,
          meta: doc.meta
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  findSimilar(docId: string, limit = 5): SearchResult[] {
    this.rebuild();

    const targetVector = this.vectors.get(docId);
    if (!targetVector) return [];

    const results: SearchResult[] = [];
    for (const doc of this.documents) {
      if (doc.id === docId) continue;

      const docVector = this.vectors.get(doc.id);
      if (!docVector) continue;

      const score = cosineSimilarity(targetVector, docVector);
      if (score > 0.05) {
        results.push({
          id: doc.id,
          score: Math.round(score * 1000) / 1000,
          source: doc.source,
          meta: doc.meta
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  get size(): number {
    return this.documents.length;
  }
}

let indexInstance: SemanticIndex | null = null;

export function getSemanticIndex(): SemanticIndex {
  if (!indexInstance) {
    indexInstance = new SemanticIndex();
  }
  return indexInstance;
}
