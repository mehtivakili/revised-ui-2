import type { SparseVector } from "@/src/lib/chatbot/nn";
import { charNgrams, digitizeNumberWords, tokenizeStemmed } from "@/src/lib/chatbot/persian";

/**
 * Hashing vectorizer. A fixed feature space means the model never needs a vocabulary
 * file, and unseen Persian words still land somewhere useful instead of being dropped.
 *
 * Three feature families are mixed so the classifier tolerates both loose word order
 * and the spelling drift that is normal in Persian chat:
 *  - stemmed word unigrams (main signal)
 *  - word bigrams (phrases such as "پهنای‌باند دوربین")
 *  - character 3-grams (typo and spacing tolerance)
 */

const wordWeight = 1;
const bigramWeight = 0.7;
const charWeight = 0.35;

/** FNV-1a: cheap, stable across runs, good enough spread for a 1024-bucket space. */
export function hashFeature(value: string, buckets: number): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % buckets;
}

export function extractFeatures(text: string): { token: string; weight: number }[] {
  const prepared = digitizeNumberWords(text);
  const tokens = tokenizeStemmed(prepared);
  const features: { token: string; weight: number }[] = [];

  for (const token of tokens) {
    // Bare numbers say more about *shape* than value, so they collapse to a magnitude bucket.
    const asNumber = Number(token);
    if (Number.isFinite(asNumber) && token !== "" && /^[\d.]+$/.test(token)) {
      features.push({ token: `#num:${magnitudeBucket(asNumber)}`, weight: wordWeight });
      continue;
    }
    features.push({ token: `w:${token}`, weight: wordWeight });
  }

  for (let index = 0; index + 1 < tokens.length; index += 1) {
    features.push({ token: `b:${tokens[index]}_${tokens[index + 1]}`, weight: bigramWeight });
  }

  for (const gram of charNgrams(prepared, 3)) {
    if (gram.trim().length < 2) continue;
    features.push({ token: `c:${gram}`, weight: charWeight });
  }

  return features;
}

function magnitudeBucket(value: number): string {
  if (value <= 0) return "0";
  if (value < 10) return "1";
  if (value < 100) return "2";
  if (value < 1_000) return "3";
  if (value < 1_000_000) return "6";
  return "9";
}

/** Builds an L2-normalised sparse vector with unique, ascending indices. */
export function vectorize(text: string, buckets: number): SparseVector {
  const accumulator = new Map<number, number>();
  for (const feature of extractFeatures(text)) {
    const index = hashFeature(feature.token, buckets);
    accumulator.set(index, (accumulator.get(index) || 0) + feature.weight);
  }

  const entries = Array.from(accumulator.entries()).sort((a, b) => a[0] - b[0]);
  const indices = new Int32Array(entries.length);
  const values = new Float32Array(entries.length);
  let norm = 0;
  for (let index = 0; index < entries.length; index += 1) {
    indices[index] = entries[index][0];
    values[index] = entries[index][1];
    norm += entries[index][1] * entries[index][1];
  }

  const inverse = norm > 0 ? 1 / Math.sqrt(norm) : 0;
  for (let index = 0; index < values.length; index += 1) values[index] *= inverse;

  return { indices, values };
}
