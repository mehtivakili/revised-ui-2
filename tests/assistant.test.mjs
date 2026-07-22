import test from "node:test";
import assert from "node:assert/strict";

import { DeepClassifier, defaultNetworkConfig } from "../src/lib/chatbot/nn.ts";
import { vectorize } from "../src/lib/chatbot/vectorizer.ts";
import { digitizeNumberWords, normalizePersian, tokenizeStemmed } from "../src/lib/chatbot/persian.ts";
import { extractSlots, referenceBitrateKbps } from "../src/lib/chatbot/slots.ts";
import { buildTrainingSamples, chatIntents, trainingCorpus } from "../src/lib/chatbot/corpus.ts";
import { searchKnowledge } from "../src/lib/chatbot/retrieval.ts";
import { checkDomain, domainVocabulary } from "../src/lib/chatbot/domain.ts";
import { storageSkill, doriSkill, raidSkill, poeSkill } from "../src/lib/chatbot/skills.ts";
import { doriDistances, focalLengthMm, horizontalFovDeg } from "../src/lib/calculators/optics.ts";
import { ackRoundTripMicroseconds, fresnelRadiusM, freeSpacePathLossDb } from "../src/lib/calculators/rf.ts";

const closeTo = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

/* ── Persian normalisation ── */

test("normalisation folds Arabic letters, ZWNJ and Persian digits", () => {
  assert.equal(normalizePersian("كيفيت ۱۰۸۰"), "کیفیت 1080");
  assert.equal(normalizePersian("پهنای‌باند"), "پهنای باند");
});

test("Persian number words become digits, including digit-plus-multiplier", () => {
  assert.equal(digitizeNumberWords("بیست و چهار دوربین"), "24 دوربین");
  assert.equal(digitizeNumberWords("۵۰ میلیون تومان"), "50000000 تومان");
  assert.equal(digitizeNumberWords("صد و بیست روز"), "120 روز");
});

test("stemming strips plural and possessive suffixes without eating short words", () => {
  assert.ok(tokenizeStemmed("دوربین‌های بیرونی").includes("دوربین"));
  assert.deepEqual(tokenizeStemmed("لنز"), ["لنز"]);
});

/* ── Slot filling ── */

test("slots read counts, resolution and archive days out of one sentence", () => {
  const slots = extractSlots("برای ۱۶ دوربین ۴ مگاپیکسل ۳۰ روز چقدر هارد میخوام");
  assert.equal(slots.cameraCount, 16);
  assert.equal(slots.megapixel, 4);
  assert.equal(slots.days, 30);
});

test("longer unit names win over shorter ones sharing a prefix", () => {
  const slots = extractSlots("لنز ۸ میلیمتر در فاصله ۲۵ متر");
  assert.equal(slots.focalMm, 8);
  assert.equal(slots.distanceM, 25);
});

test("weeks and months normalise to days, and 4k implies 8 megapixel", () => {
  assert.equal(extractSlots("آرشیو دو هفته").days, 14);
  assert.equal(extractSlots("ضبط سه ماه").days, 90);
  assert.equal(extractSlots("دوربین 4k").megapixel, 8);
});

test("units keep their meaning when Persian adds an adjectival suffix", () => {
  const slots = extractSlots("raid 6 با ۸ هارد ۸ ترابایتی");
  assert.equal(slots.diskCount, 8);
  assert.equal(slots.terabytes, 8);

  assert.equal(extractSlots("۱۲ دوربین ۱۵ واتی").watts, 15);
  assert.equal(extractSlots("آرشیو ۳۰ روزه").days, 30);
  assert.equal(extractSlots("لینک ۵ کیلومتری").distanceKm, 5);
});

test("network and RAID operands are recovered", () => {
  const network = extractSlots("ip 192.168.1.10/24 چه شبکه ای است");
  assert.equal(network.ipAddress, "192.168.1.10");
  assert.equal(network.prefix, 24);

  const raid = extractSlots("raid 6 با ۸ دیسک ۴ ترابایت");
  assert.equal(raid.raidLevel, "6");
  assert.equal(raid.diskCount, 8);
  assert.equal(raid.terabytes, 4);
});

test("task words map to the DORI goal that drives lens choice", () => {
  assert.equal(extractSlots("برای پلاک خوانی").goal, "anpr");
  assert.equal(extractSlots("شناسایی چهره در ۲۰ متری").goal, "identify");
  assert.equal(extractSlots("فقط کشف حضور کافی است").goal, "detect");
});

/* ── Vectorizer ── */

test("vectorizer emits an L2-normalised sparse vector with ascending unique indices", () => {
  const vector = vectorize("پهنای باند ۱۶ دوربین چقدره", defaultNetworkConfig.inputDim);
  assert.ok(vector.indices.length > 0);

  let norm = 0;
  for (let index = 0; index < vector.values.length; index += 1) norm += vector.values[index] ** 2;
  closeTo(Math.sqrt(norm), 1, 1e-5);

  for (let index = 1; index < vector.indices.length; index += 1) {
    assert.ok(vector.indices[index] > vector.indices[index - 1], "indices must be strictly ascending");
    assert.ok(vector.indices[index] < defaultNetworkConfig.inputDim, "indices must stay inside the hash space");
  }
});

test("paraphrases land closer together than unrelated sentences", () => {
  const cosine = (a, b) => {
    const map = new Map();
    for (let index = 0; index < a.indices.length; index += 1) map.set(a.indices[index], a.values[index]);
    let dot = 0;
    for (let index = 0; index < b.indices.length; index += 1) dot += (map.get(b.indices[index]) || 0) * b.values[index];
    return dot;
  };

  const dim = defaultNetworkConfig.inputDim;
  const anchor = vectorize("چند ترابایت هارد نیاز دارم", dim);
  const paraphrase = vectorize("چقدر هارد نیاز دارم", dim);
  const unrelated = vectorize("زاویه دید لنز چند درجه است", dim);
  assert.ok(cosine(anchor, paraphrase) > cosine(anchor, unrelated));
});

/* ── Neural network ── */

test("network learns the bundled corpus to high training accuracy", () => {
  const config = { ...defaultNetworkConfig, outputDim: chatIntents.length };
  const samples = buildTrainingSamples();
  const vectors = samples.map((sample) => vectorize(sample.text, config.inputDim));
  const labels = samples.map((sample) => sample.label);

  const classifier = new DeepClassifier(config);
  const order = vectors.map((_, index) => index);
  for (let epoch = 0; epoch < 90; epoch += 1) {
    for (let start = 0; start < order.length; start += config.batchSize) {
      const slice = order.slice(start, start + config.batchSize);
      classifier.trainBatch(slice.map((index) => vectors[index]), slice.map((index) => labels[index]));
    }
    order.sort(() => Math.random() - 0.5);
  }

  let correct = 0;
  for (let index = 0; index < vectors.length; index += 1) {
    const output = classifier.predict(vectors[index]);
    let best = 0;
    for (let unit = 1; unit < output.length; unit += 1) if (output[unit] > output[best]) best = unit;
    if (best === labels[index]) correct += 1;
  }
  const accuracy = correct / vectors.length;
  assert.ok(accuracy > 0.9, `training accuracy was ${accuracy}`);
});

test("softmax output is a probability distribution", () => {
  const config = { ...defaultNetworkConfig, outputDim: chatIntents.length };
  const classifier = new DeepClassifier(config);
  const output = classifier.predict(vectorize("سلام", config.inputDim));
  assert.equal(output.length, chatIntents.length);

  let sum = 0;
  for (let index = 0; index < output.length; index += 1) {
    assert.ok(output[index] >= 0 && output[index] <= 1);
    sum += output[index];
  }
  closeTo(sum, 1, 1e-4);
});

test("int8 serialisation round-trips within quantisation error", () => {
  const config = { ...defaultNetworkConfig, outputDim: 6 };
  const classifier = new DeepClassifier(config);
  const samples = [vectorize("چند ترابایت هارد", config.inputDim), vectorize("زاویه دید لنز", config.inputDim)];
  for (let step = 0; step < 25; step += 1) classifier.trainBatch(samples, [0, 3]);

  const restored = DeepClassifier.deserialize(JSON.parse(JSON.stringify(classifier.serialize())));
  const before = classifier.predict(samples[0]);
  const after = restored.predict(samples[0]);
  for (let index = 0; index < before.length; index += 1) closeTo(after[index], before[index], 0.03);
});

/* ── Retrieval ── */

test("retrieval finds the codec article for a codec question", () => {
  const hits = searchKnowledge("فرق h264 و h265 چیه", 3);
  assert.ok(hits.length > 0);
  assert.equal(hits[0].article.id, "codec");
});

test("retrieval scores are ordered and bounded", () => {
  const hits = searchKnowledge("ip66 یعنی چی", 3);
  assert.equal(hits[0].article.id, "ip-rating");
  for (let index = 1; index < hits.length; index += 1) {
    assert.ok(hits[index - 1].score >= hits[index].score);
  }
});

/* ── Skills ── */

test("storage skill reproduces the capacity calculator for 16×4MP over 30 days", () => {
  const answer = storageSkill(extractSlots("برای ۱۶ دوربین ۴ مگاپیکسل ۳۰ روز چقدر هارد میخوام"));
  assert.equal(answer.source, "calculation");

  const body = answer.lines.join("\n");
  // 16 cameras × 4000 Kbps of H.265 is 64 Mbps of aggregate load.
  assert.ok(body.includes(new Intl.NumberFormat("fa-IR").format(64)), body);

  const expectedTb = ((64_000 * 1_000 / 8) * 3_600 * 24 * 30 / 1e12) * 1.15 * 1.05 * 1.1;
  const rendered = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(expectedTb);
  assert.ok(body.includes(rendered), `expected ${rendered} in:\n${body}`);
});

test("skills report the defaults they had to invent", () => {
  const withoutNumbers = storageSkill(extractSlots("چقدر هارد لازم دارم"));
  assert.ok(withoutNumbers.assumptions.some((item) => item.includes("تعداد دوربین فرض شد")));

  const withNumbers = storageSkill(extractSlots("۱۶ دوربین ۴ مگاپیکسل ۳۰ روز"));
  assert.ok(!withNumbers.assumptions.some((item) => item.includes("تعداد دوربین فرض شد")));
});

test("DORI skill orders the four ranges from widest to narrowest", () => {
  const distances = doriDistances(2560, 90);
  assert.ok(distances.detection > distances.observation);
  assert.ok(distances.observation > distances.recognition);
  assert.ok(distances.recognition > distances.identification);

  const answer = doriSkill(extractSlots("فاصله شناسایی دوربین ۴ مگاپیکسل"));
  assert.equal(answer.tool.slug, "dori");
});

test("RAID skill rejects impossible arrays instead of returning a number", () => {
  const answer = raidSkill(extractSlots("raid 6 با ۳ دیسک ۴ ترابایت"));
  assert.ok(answer.lines[0].includes("معتبر نیست"));
});

test("PoE skill picks the standard that matches the per-camera draw", () => {
  assert.ok(poeSkill(extractSlots("۱۶ دوربین ۸ وات")).lines[0].includes("802.3af"));
  assert.ok(poeSkill(extractSlots("۴ دوربین ۲۰ وات")).lines[0].includes("802.3at"));
  assert.ok(poeSkill(extractSlots("۲ دوربین ۶۰ وات")).lines[0].includes("802.3bt"));
});

test("reference bitrate rises with resolution and doubles for H.264", () => {
  assert.ok(referenceBitrateKbps(4) > referenceBitrateKbps(2));
  assert.equal(referenceBitrateKbps(4, "H.264"), referenceBitrateKbps(4, "H.265") * 2);
});

/* ── Shared calculator maths ── */

test("optics helpers agree with the lens and view-angle tools", () => {
  closeTo(focalLengthMm(10, 10, 4.8), 4.8);
  closeTo(horizontalFovDeg(4, 4.8), (2 * Math.atan(4.8 / 8) * 180) / Math.PI);
});

test("RF helpers match published reference values", () => {
  // FSPL at 1 km / 1 MHz is the 32.44 dB constant by definition.
  closeTo(freeSpacePathLossDb(1, 1), 32.44, 1e-9);
  // Light covers 20 km round trip in ~66.7 microseconds.
  closeTo(ackRoundTripMicroseconds(10), 66.71, 0.01);
  closeTo(fresnelRadiusM(1, 2.4), 17.32 * Math.sqrt(1 / 9.6), 1e-9);
});

/* ── Out-of-domain guard ── */

test("domain guard accepts CCTV questions and rejects unrelated ones", () => {
  for (const question of [
    "ip66 یعنی چی",
    "چقدر هارد لازم دارم",
    "raid 6 با ۸ دیسک",
    "سلام",
    "دوربین تصویر نمیده"
  ]) {
    assert.ok(checkDomain(question).inDomain, `expected in-domain: ${question}`);
  }

  for (const question of [
    "دستور پخت قرمه سبزی",
    "بلیت هواپیما به شیراز",
    "بلیت هواپیما به شیراز میخوام",
    "معنی زندگی چیست",
    "آهنگ جدید بذار"
  ]) {
    assert.equal(checkDomain(question).inDomain, false, `expected out-of-domain: ${question}`);
  }
});

test("domain vocabulary excludes article prose so ordinary Persian cannot slip through", () => {
  const words = domainVocabulary();
  // These appear in article bodies but must not be treated as domain evidence.
  assert.equal(words.has("بیشتر"), false);
  assert.equal(words.has("همیشه"), false);
});

test("one topic word is enough, one generic verb is not", () => {
  assert.ok(checkDomain("هارد").inDomain, "a topic noun alone should qualify");
  assert.equal(checkDomain("میخوام").inDomain, false, "a bare request verb should not qualify");
  assert.ok(checkDomain("nvr میخوام").inDomain, "verb plus topic noun should qualify");
});

/* ── Corpus hygiene ── */

test("every intent has training utterances and no duplicates across intents", () => {
  const seen = new Map();
  for (const intent of chatIntents) {
    const utterances = trainingCorpus[intent];
    assert.ok(utterances.length >= 4, `${intent} has too few utterances`);
    for (const text of utterances) {
      const key = normalizePersian(text);
      assert.ok(!seen.has(key), `"${text}" appears in both ${seen.get(key)} and ${intent}`);
      seen.set(key, intent);
    }
  }
});
