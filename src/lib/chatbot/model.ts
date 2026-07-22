import { buildSplitSamples, chatIntents, corpusFingerprint, type ChatIntent } from "@/src/lib/chatbot/corpus";
import { DeepClassifier, defaultNetworkConfig, mulberry32, type SerializedModel, type SparseVector } from "@/src/lib/chatbot/nn";
import { vectorize } from "@/src/lib/chatbot/vectorizer";

/**
 * Owns the lifecycle of the intent network.
 *
 * Training happens on the main thread but in small time-sliced chunks, so the chat
 * stays responsive while the model converges. Until it is ready the engine answers
 * from retrieval alone, and the finished int8 weights are cached in localStorage so
 * every later visit starts instantly.
 */

export type ModelStatus = "idle" | "loading" | "training" | "ready" | "failed";

export type ModelState = {
  status: ModelStatus;
  progress: number;
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy: number;
  origin: "cache" | "trained" | "none";
};

export type Classification = {
  intent: ChatIntent;
  confidence: number;
  ranked: { intent: ChatIntent; score: number }[];
};

const totalEpochs = 80;
/** Wall-clock budget per slice. Long enough to make progress, short enough not to stutter. */
const sliceBudgetMs = 40;
/** Epochs of no validation improvement before training stops. */
const patience = 14;
const storagePrefix = "hamyardoorbin.assistant.model";

function storageKey() {
  return `${storagePrefix}.v2.${corpusFingerprint()}`;
}

export class AssistantModel {
  private static instance: AssistantModel | null = null;

  private classifier: DeepClassifier | null = null;
  private vectors: SparseVector[] = [];
  private labels: number[] = [];
  private validationVectors: SparseVector[] = [];
  private validationLabels: number[] = [];
  private bestValidation = -1;
  private bestSnapshot: ReturnType<DeepClassifier["snapshotWeights"]> | null = null;
  private epochsSinceImprovement = 0;
  private listeners = new Set<(state: ModelState) => void>();
  private started = false;
  private random = mulberry32(defaultNetworkConfig.seed ^ 0x5f3759df);

  private state: ModelState = {
    status: "idle",
    progress: 0,
    epoch: 0,
    totalEpochs,
    loss: 0,
    accuracy: 0,
    origin: "none"
  };

  static getInstance(): AssistantModel {
    AssistantModel.instance ||= new AssistantModel();
    return AssistantModel.instance;
  }

  getState(): ModelState {
    return this.state;
  }

  subscribe(listener: (state: ModelState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(patch: Partial<ModelState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  /** Idempotent: safe to call from every mounted chat surface. */
  start() {
    if (this.started) return;
    this.started = true;
    this.setState({ status: "loading" });

    // Vectorising the whole corpus is cheap but not free; keep it off the first paint.
    this.defer(() => {
      const config = { ...defaultNetworkConfig, outputDim: chatIntents.length };
      const { train, validation } = buildSplitSamples();
      this.vectors = train.map((sample) => vectorize(sample.text, config.inputDim));
      this.labels = train.map((sample) => sample.label);
      this.validationVectors = validation.map((sample) => vectorize(sample.text, config.inputDim));
      this.validationLabels = validation.map((sample) => sample.label);

      if (this.loadFromCache(config)) return;

      this.classifier = new DeepClassifier(config);
      this.setState({ status: "training", epoch: 0, progress: 0 });
      this.scheduleSlice();
    });
  }

  private loadFromCache(config: typeof defaultNetworkConfig): boolean {
    if (typeof localStorage === "undefined") return false;
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return false;
      const snapshot = JSON.parse(raw) as SerializedModel;
      if (snapshot.config.inputDim !== config.inputDim || snapshot.config.outputDim !== config.outputDim) return false;
      this.classifier = DeepClassifier.deserialize(snapshot);
      this.setState({
        status: "ready",
        origin: "cache",
        progress: 1,
        epoch: totalEpochs,
        accuracy: this.evaluate()
      });
      return true;
    } catch {
      try {
        localStorage.removeItem(storageKey());
      } catch {
        /* storage unavailable or full; training from scratch is the fallback */
      }
      return false;
    }
  }

  /**
   * Yields to the event loop between chunks.
   *
   * Deliberately not requestAnimationFrame: browsers pause rAF in background tabs, so
   * training would stall the moment the user switched away. setTimeout keeps making
   * progress (throttled, but progress) and still yields on a visible tab.
   */
  private defer(work: () => void) {
    setTimeout(work, 0);
  }

  private scheduleSlice() {
    this.defer(() => this.runSlice());
  }

  private runSlice() {
    const classifier = this.classifier;
    if (!classifier) return;

    const deadline = Date.now() + sliceBudgetMs;
    let loss = 0;
    let batches = 0;
    let epoch = this.state.epoch;

    // Always run at least one epoch, then keep going while the frame budget allows.
    do {
      const order = this.shuffledOrder();
      for (let start = 0; start < order.length; start += classifier.config.batchSize) {
        const slice = order.slice(start, start + classifier.config.batchSize);
        loss += classifier.trainBatch(
          slice.map((index) => this.vectors[index]),
          slice.map((index) => this.labels[index])
        );
        batches += 1;
      }
      epoch += 1;
    } while (epoch < totalEpochs && Date.now() < deadline);

    // Early stopping. Validation is measured on held-out *utterances*, so an improvement
    // here reflects generalisation rather than another pass over memorised sentences.
    const validationAccuracy = this.evaluate(this.validationVectors, this.validationLabels);
    if (validationAccuracy > this.bestValidation) {
      this.bestValidation = validationAccuracy;
      this.bestSnapshot = classifier.snapshotWeights();
      this.epochsSinceImprovement = 0;
    } else {
      this.epochsSinceImprovement += 1;
    }

    const target = epoch;
    const exhausted = target >= totalEpochs;
    const stalled = this.epochsSinceImprovement >= patience;
    const done = exhausted || stalled;

    // Roll back to the best validation epoch rather than shipping the last one, which
    // is usually further into overfitting.
    if (done && this.bestSnapshot) classifier.restoreWeights(this.bestSnapshot);

    this.setState({
      epoch: target,
      progress: done ? 1 : target / totalEpochs,
      loss: batches ? loss / batches : this.state.loss,
      status: done ? "ready" : "training",
      origin: done ? "trained" : this.state.origin,
      accuracy: done ? this.bestValidation : this.state.accuracy
    });

    if (done) this.persist();
    else this.scheduleSlice();
  }

  private shuffledOrder(): number[] {
    const order = this.vectors.map((_, index) => index);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(this.random() * (index + 1));
      [order[index], order[swap]] = [order[swap], order[index]];
    }
    return order;
  }

  private evaluate(vectors = this.vectors, labels = this.labels): number {
    const classifier = this.classifier;
    if (!classifier || !vectors.length) return 0;
    let correct = 0;
    for (let index = 0; index < vectors.length; index += 1) {
      const output = classifier.predict(vectors[index]);
      let best = 0;
      for (let unit = 1; unit < output.length; unit += 1) {
        if (output[unit] > output[best]) best = unit;
      }
      if (best === labels[index]) correct += 1;
    }
    return correct / vectors.length;
  }

  private persist() {
    if (!this.classifier || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(storageKey(), JSON.stringify(this.classifier.serialize()));
      // Drop weights left behind by an older corpus so storage does not grow unbounded.
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);
        if (key && key.startsWith(storagePrefix) && key !== storageKey()) localStorage.removeItem(key);
      }
    } catch {
      /* quota exceeded or private mode: the model still works for this session */
    }
  }

  isReady(): boolean {
    return this.state.status === "ready" && this.classifier !== null;
  }

  classify(text: string): Classification | null {
    const classifier = this.classifier;
    if (!classifier || this.state.status !== "ready") return null;

    const output = classifier.predict(vectorize(text, classifier.config.inputDim));
    const ranked = chatIntents
      .map((intent, index) => ({ intent, score: output[index] }))
      .sort((a, b) => b.score - a.score);

    return { intent: ranked[0].intent, confidence: ranked[0].score, ranked: ranked.slice(0, 5) };
  }
}
