import { articleText, knowledgeBase, type KnowledgeArticle } from "@/src/lib/chatbot/knowledge";
import { charNgrams, digitizeNumberWords, tokenizeStemmed } from "@/src/lib/chatbot/persian";

/**
 * TF-IDF retrieval over the bundled knowledge base.
 *
 * This runs alongside the neural classifier rather than behind it: the network decides
 * *what kind* of answer to give, retrieval decides *which article* backs it up. It is
 * also the fallback that keeps the assistant useful during the first-load training pass.
 */

type IndexedDocument = {
  article: KnowledgeArticle;
  termFrequency: Map<string, number>;
  ngrams: Set<string>;
  norm: number;
};

let documents: IndexedDocument[] | null = null;
let inverseDocumentFrequency: Map<string, number> | null = null;

function buildIndex() {
  const rawDocuments = knowledgeBase.map((article) => {
    // Title and keywords are repeated so an exact topic word outranks a passing mention.
    const source = [article.title, article.title, article.keywords.join(" "), article.keywords.join(" "), articleText(article)].join(" ");
    const tokens = tokenizeStemmed(source);
    const termFrequency = new Map<string, number>();
    for (const token of tokens) termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
    return { article, termFrequency, ngrams: new Set(charNgrams(`${article.title} ${article.keywords.join(" ")}`, 3)) };
  });

  const documentFrequency = new Map<string, number>();
  for (const document of rawDocuments) {
    for (const term of document.termFrequency.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }

  const total = rawDocuments.length;
  const idf = new Map<string, number>();
  for (const [term, count] of documentFrequency) {
    idf.set(term, Math.log((total + 1) / (count + 0.5)) + 1);
  }

  documents = rawDocuments.map((document) => {
    let norm = 0;
    for (const [term, frequency] of document.termFrequency) {
      const weight = (1 + Math.log(frequency)) * (idf.get(term) || 1);
      norm += weight * weight;
    }
    return { ...document, norm: Math.sqrt(norm) || 1 };
  });
  inverseDocumentFrequency = idf;
}

export type RetrievalHit = { article: KnowledgeArticle; score: number };

export function searchKnowledge(queryText: string, limit = 3): RetrievalHit[] {
  if (!documents || !inverseDocumentFrequency) buildIndex();
  const index = documents!;
  const idf = inverseDocumentFrequency!;

  const prepared = digitizeNumberWords(queryText);
  const queryTokens = tokenizeStemmed(prepared);
  if (!queryTokens.length) return [];

  const queryFrequency = new Map<string, number>();
  for (const token of queryTokens) queryFrequency.set(token, (queryFrequency.get(token) || 0) + 1);

  let queryNorm = 0;
  for (const [term, frequency] of queryFrequency) {
    const weight = (1 + Math.log(frequency)) * (idf.get(term) || 1);
    queryNorm += weight * weight;
  }
  queryNorm = Math.sqrt(queryNorm) || 1;

  const queryNgrams = new Set(charNgrams(prepared, 3));

  return index
    .map((document) => {
      let dot = 0;
      for (const [term, frequency] of queryFrequency) {
        const documentFrequency = document.termFrequency.get(term);
        if (!documentFrequency) continue;
        const weight = (idf.get(term) || 1) ** 2;
        dot += (1 + Math.log(frequency)) * (1 + Math.log(documentFrequency)) * weight;
      }
      const cosine = dot / (queryNorm * document.norm);
      // Character overlap rescues misspelled topic words that the token match misses.
      const overlap = jaccard(queryNgrams, document.ngrams);
      return { article: document.article, score: cosine * 0.82 + overlap * 0.18 };
    })
    .filter((hit) => hit.score > 0.015)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}
