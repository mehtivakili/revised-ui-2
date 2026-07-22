import { chatIntents, trainingCorpus } from "@/src/lib/chatbot/corpus";
import { knowledgeBase } from "@/src/lib/chatbot/knowledge";
import { digitizeNumberWords, tokenizeStemmed } from "@/src/lib/chatbot/persian";

/**
 * Out-of-domain guard.
 *
 * A softmax always returns *something*, and with 42 narrow intents an unrelated
 * sentence can still come back confident. Before trusting the classifier we check that
 * the message shares at least one content word with the assistant's subject matter.
 *
 * The vocabulary is built only from training utterances, article titles and article
 * keywords — never article bodies, which contain enough ordinary Persian prose to
 * match almost any sentence and defeat the purpose of the check.
 */

/**
 * Pure function words. They appear all over the corpus ("تبدیل dbm به mw") but carry no
 * topic signal, so a sentence made only of these is not a CCTV question.
 */
const functionWords = new Set([
  "به", "از", "با", "در", "را", "رو", "و", "که", "این", "آن", "اون", "برای", "تا", "یا",
  "هم", "هر", "چه", "چی", "چیه", "چیست", "چند", "چنده", "چقدر", "چقدره", "یعنی", "است",
  "هست", "هستش", "باید", "بر", "بی", "نه", "بله", "من", "تو", "ما", "شما", "او", "آیا",
  "کدام", "کدوم", "کجا", "کی", "بین", "روی", "زیر", "بالا", "پایین", "لطفا", "میشه",
  "شود", "بود", "باشه", "باشد", "دارد", "داره", "کرد", "شده", "های", "ای", "یک", "یه",
  "دو", "سه", "خیلی", "بیشتر", "کمتر", "همیشه", "اگر", "ولی", "اما", "پس", "دیگه", "دیگر"
]);

/** Intents that are about talking to the assistant rather than about CCTV. */
const conversationalIntents = ["greeting", "thanks", "help_menu", "identity", "contact"] as const;

type Vocabulary = { strong: Set<string>; weak: Set<string> };

let vocabulary: Vocabulary | null = null;

function buildVocabulary(): Vocabulary {
  const strong = new Set<string>();
  const weak = new Set<string>();

  const collect = (text: string, target: Set<string>) => {
    for (const token of tokenizeStemmed(text)) {
      if (token.length >= 2 && !/^\d+$/.test(token) && !functionWords.has(token)) target.add(token);
    }
  };

  // Article titles and keywords are the topic words themselves — one is enough.
  for (const article of knowledgeBase) {
    collect(article.title, strong);
    collect(article.keywords.join(" "), strong);
  }
  // So are greetings and "what can you do", or the assistant could not be addressed at all.
  for (const intent of conversationalIntents) {
    for (const utterance of trainingCorpus[intent]) collect(utterance, strong);
  }

  // Everything else in the corpus is supporting phrasing: verbs like "میخوام" show up in
  // plenty of off-topic sentences, so a single one of them does not make a question ours.
  for (const intent of chatIntents) {
    for (const utterance of trainingCorpus[intent]) collect(utterance, weak);
  }
  for (const token of strong) weak.delete(token);

  return { strong, weak };
}

export function domainVocabulary(): Set<string> {
  vocabulary ||= buildVocabulary();
  return new Set([...vocabulary.strong, ...vocabulary.weak]);
}

export type DomainCheck = { inDomain: boolean; matched: string[] };

export function checkDomain(text: string): DomainCheck {
  vocabulary ||= buildVocabulary();
  const tokens = tokenizeStemmed(digitizeNumberWords(text)).filter((token) => !functionWords.has(token));

  const strongMatches = tokens.filter((token) => vocabulary!.strong.has(token));
  const weakMatches = tokens.filter((token) => vocabulary!.weak.has(token));

  return {
    inDomain: strongMatches.length > 0 || weakMatches.length >= 2,
    matched: [...strongMatches, ...weakMatches]
  };
}
