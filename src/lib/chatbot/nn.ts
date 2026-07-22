/**
 * Dependency-free deep neural network used by the offline assistant.
 *
 * Topology is a fully connected MLP (input -> ReLU -> ReLU -> softmax) trained with
 * mini-batch Adam and inverted dropout. Nothing here talks to a network: the model is
 * trained in the browser from the bundled corpus and cached as int8 weights.
 *
 * The first layer reads a sparse input vector, so its cost scales with the number of
 * active features in a sentence (~70) instead of the full hashing space (1024).
 */

export type SparseVector = { indices: Int32Array; values: Float32Array };

export type DenseLayer = {
  inputDim: number;
  outputDim: number;
  weights: Float32Array;
  bias: Float32Array;
  mWeights: Float32Array;
  vWeights: Float32Array;
  mBias: Float32Array;
  vBias: Float32Array;
};

export type NetworkConfig = {
  inputDim: number;
  hiddenUnits: number[];
  outputDim: number;
  dropout: number;
  learningRate: number;
  weightDecay: number;
  batchSize: number;
  seed: number;
};

/**
 * Capacity and regularisation are deliberately conservative.
 *
 * The first version used 192/96 hidden units with dropout 0.15 and decay 1e-5, which is
 * ~216k parameters against a few hundred samples: it reached 100% training accuracy and
 * 58% on held-out paraphrases. Halving the width and raising both regularisers trades
 * training accuracy — which was meaningless — for generalisation.
 */
export const defaultNetworkConfig: NetworkConfig = {
  inputDim: 1024,
  hiddenUnits: [128, 64],
  outputDim: 0,
  dropout: 0.25,
  learningRate: 0.006,
  weightDecay: 2e-4,
  batchSize: 32,
  seed: 20260722
};

/** Deterministic PRNG so a cached model and a freshly trained one agree. */
export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function createLayer(inputDim: number, outputDim: number, random: () => number): DenseLayer {
  const weights = new Float32Array(outputDim * inputDim);
  // He initialisation keeps ReLU activations from collapsing across three layers.
  const scale = Math.sqrt(2 / inputDim);
  for (let index = 0; index < weights.length; index += 1) weights[index] = gaussian(random) * scale;
  return {
    inputDim,
    outputDim,
    weights,
    bias: new Float32Array(outputDim),
    mWeights: new Float32Array(outputDim * inputDim),
    vWeights: new Float32Array(outputDim * inputDim),
    mBias: new Float32Array(outputDim),
    vBias: new Float32Array(outputDim)
  };
}

export class DeepClassifier {
  readonly config: NetworkConfig;
  readonly layers: DenseLayer[];
  private step = 0;
  private random: () => number;

  constructor(config: NetworkConfig) {
    this.config = config;
    this.random = mulberry32(config.seed);
    const dims = [config.inputDim, ...config.hiddenUnits, config.outputDim];
    this.layers = [];
    for (let index = 0; index + 1 < dims.length; index += 1) {
      this.layers.push(createLayer(dims[index], dims[index + 1], this.random));
    }
  }

  /** Forward pass for inference. Returns the softmax distribution over intents. */
  predict(input: SparseVector): Float32Array {
    let activation = this.forwardSparse(this.layers[0], input);
    relu(activation);
    for (let index = 1; index < this.layers.length; index += 1) {
      activation = forwardDense(this.layers[index], activation);
      if (index < this.layers.length - 1) relu(activation);
    }
    softmax(activation);
    return activation;
  }

  private forwardSparse(layer: DenseLayer, input: SparseVector): Float32Array {
    const output = new Float32Array(layer.outputDim);
    const { indices, values } = input;
    for (let unit = 0; unit < layer.outputDim; unit += 1) {
      const rowOffset = unit * layer.inputDim;
      let sum = layer.bias[unit];
      for (let n = 0; n < indices.length; n += 1) sum += layer.weights[rowOffset + indices[n]] * values[n];
      output[unit] = sum;
    }
    return output;
  }

  /**
   * Runs one mini-batch of Adam. Returns the mean cross-entropy of the batch so the
   * caller can surface training progress.
   */
  trainBatch(samples: SparseVector[], labels: number[]): number {
    const gradWeights = this.layers.map((layer) => new Float32Array(layer.weights.length));
    const gradBias = this.layers.map((layer) => new Float32Array(layer.bias.length));
    let loss = 0;

    for (let s = 0; s < samples.length; s += 1) {
      const input = samples[s];
      const activations: Float32Array[] = [];
      const dropoutMasks: (Float32Array | null)[] = [];

      let current = this.forwardSparse(this.layers[0], input);
      relu(current);
      let mask = this.sampleDropoutMask(current.length);
      if (mask) applyMask(current, mask);
      activations.push(current);
      dropoutMasks.push(mask);

      for (let index = 1; index < this.layers.length; index += 1) {
        current = forwardDense(this.layers[index], activations[index - 1]);
        if (index < this.layers.length - 1) {
          relu(current);
          mask = this.sampleDropoutMask(current.length);
          if (mask) applyMask(current, mask);
          dropoutMasks.push(mask);
        } else {
          dropoutMasks.push(null);
        }
        activations.push(current);
      }

      const output = activations[activations.length - 1];
      softmax(output);
      const label = labels[s];
      loss += -Math.log(Math.max(1e-9, output[label]));

      // Softmax + cross-entropy collapse to (p - y) at the output layer.
      let delta = new Float32Array(output.length);
      for (let index = 0; index < output.length; index += 1) delta[index] = output[index];
      delta[label] -= 1;

      for (let index = this.layers.length - 1; index >= 1; index -= 1) {
        const layer = this.layers[index];
        const previous = activations[index - 1];
        const gW = gradWeights[index];
        const gB = gradBias[index];
        for (let unit = 0; unit < layer.outputDim; unit += 1) {
          const d = delta[unit];
          if (d === 0) continue;
          const rowOffset = unit * layer.inputDim;
          gB[unit] += d;
          for (let i = 0; i < layer.inputDim; i += 1) gW[rowOffset + i] += d * previous[i];
        }

        const nextDelta = new Float32Array(layer.inputDim);
        for (let unit = 0; unit < layer.outputDim; unit += 1) {
          const d = delta[unit];
          if (d === 0) continue;
          const rowOffset = unit * layer.inputDim;
          for (let i = 0; i < layer.inputDim; i += 1) nextDelta[i] += d * layer.weights[rowOffset + i];
        }
        // Backprop through ReLU then through the dropout mask that was applied forward.
        const previousMask = dropoutMasks[index - 1];
        for (let i = 0; i < nextDelta.length; i += 1) {
          if (previous[i] <= 0) nextDelta[i] = 0;
          else if (previousMask) nextDelta[i] *= previousMask[i];
        }
        delta = nextDelta;
      }

      const first = this.layers[0];
      const gW0 = gradWeights[0];
      const gB0 = gradBias[0];
      for (let unit = 0; unit < first.outputDim; unit += 1) {
        const d = delta[unit];
        if (d === 0) continue;
        const rowOffset = unit * first.inputDim;
        gB0[unit] += d;
        for (let n = 0; n < input.indices.length; n += 1) {
          gW0[rowOffset + input.indices[n]] += d * input.values[n];
        }
      }
    }

    const scale = 1 / Math.max(1, samples.length);
    this.step += 1;
    for (let index = 0; index < this.layers.length; index += 1) {
      this.applyAdam(this.layers[index], gradWeights[index], gradBias[index], scale);
    }
    return loss * scale;
  }

  private applyAdam(layer: DenseLayer, gradW: Float32Array, gradB: Float32Array, scale: number) {
    const { learningRate, weightDecay } = this.config;
    const beta1 = 0.9;
    const beta2 = 0.999;
    const epsilon = 1e-8;
    const biasCorrection1 = 1 - Math.pow(beta1, this.step);
    const biasCorrection2 = 1 - Math.pow(beta2, this.step);

    for (let index = 0; index < layer.weights.length; index += 1) {
      const gradient = gradW[index] * scale + weightDecay * layer.weights[index];
      const m = layer.mWeights[index] = beta1 * layer.mWeights[index] + (1 - beta1) * gradient;
      const v = layer.vWeights[index] = beta2 * layer.vWeights[index] + (1 - beta2) * gradient * gradient;
      layer.weights[index] -= learningRate * (m / biasCorrection1) / (Math.sqrt(v / biasCorrection2) + epsilon);
    }
    for (let index = 0; index < layer.bias.length; index += 1) {
      const gradient = gradB[index] * scale;
      const m = layer.mBias[index] = beta1 * layer.mBias[index] + (1 - beta1) * gradient;
      const v = layer.vBias[index] = beta2 * layer.vBias[index] + (1 - beta2) * gradient * gradient;
      layer.bias[index] -= learningRate * (m / biasCorrection1) / (Math.sqrt(v / biasCorrection2) + epsilon);
    }
  }

  private sampleDropoutMask(size: number): Float32Array | null {
    const rate = this.config.dropout;
    if (rate <= 0) return null;
    const mask = new Float32Array(size);
    const keepScale = 1 / (1 - rate);
    for (let index = 0; index < size; index += 1) mask[index] = this.random() < rate ? 0 : keepScale;
    return mask;
  }

  /** Full-precision copy, used to roll back to the best validation epoch. */
  snapshotWeights(): { weights: Float32Array; bias: Float32Array }[] {
    return this.layers.map((layer) => ({
      weights: Float32Array.from(layer.weights),
      bias: Float32Array.from(layer.bias)
    }));
  }

  restoreWeights(snapshot: { weights: Float32Array; bias: Float32Array }[]) {
    for (let index = 0; index < this.layers.length; index += 1) {
      this.layers[index].weights.set(snapshot[index].weights);
      this.layers[index].bias.set(snapshot[index].bias);
    }
  }

  /** int8-quantised snapshot small enough for localStorage. */
  serialize(): SerializedModel {
    return {
      config: this.config,
      layers: this.layers.map((layer) => {
        const weightScale = maxAbs(layer.weights) / 127 || 1;
        const biasScale = maxAbs(layer.bias) / 127 || 1;
        return {
          inputDim: layer.inputDim,
          outputDim: layer.outputDim,
          weightScale,
          biasScale,
          weights: encodeInt8(layer.weights, weightScale),
          bias: encodeInt8(layer.bias, biasScale)
        };
      })
    };
  }

  static deserialize(snapshot: SerializedModel): DeepClassifier {
    const model = new DeepClassifier(snapshot.config);
    for (let index = 0; index < model.layers.length; index += 1) {
      const layer = model.layers[index];
      const stored = snapshot.layers[index];
      if (!stored || stored.inputDim !== layer.inputDim || stored.outputDim !== layer.outputDim) {
        throw new Error("shape mismatch in cached model");
      }
      decodeInt8(stored.weights, stored.weightScale, layer.weights);
      decodeInt8(stored.bias, stored.biasScale, layer.bias);
    }
    return model;
  }
}

export type SerializedLayer = {
  inputDim: number;
  outputDim: number;
  weightScale: number;
  biasScale: number;
  weights: string;
  bias: string;
};

export type SerializedModel = { config: NetworkConfig; layers: SerializedLayer[] };

function forwardDense(layer: DenseLayer, input: Float32Array): Float32Array {
  const output = new Float32Array(layer.outputDim);
  for (let unit = 0; unit < layer.outputDim; unit += 1) {
    const rowOffset = unit * layer.inputDim;
    let sum = layer.bias[unit];
    for (let i = 0; i < layer.inputDim; i += 1) sum += layer.weights[rowOffset + i] * input[i];
    output[unit] = sum;
  }
  return output;
}

function relu(values: Float32Array) {
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] < 0) values[index] = 0;
  }
}

function applyMask(values: Float32Array, mask: Float32Array) {
  for (let index = 0; index < values.length; index += 1) values[index] *= mask[index];
}

export function softmax(values: Float32Array) {
  let max = -Infinity;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] > max) max = values[index];
  }
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    const exponent = Math.exp(values[index] - max);
    values[index] = exponent;
    sum += exponent;
  }
  const inverse = 1 / (sum || 1);
  for (let index = 0; index < values.length; index += 1) values[index] *= inverse;
}

function maxAbs(values: Float32Array) {
  let max = 0;
  for (let index = 0; index < values.length; index += 1) {
    const absolute = Math.abs(values[index]);
    if (absolute > max) max = absolute;
  }
  return max;
}

function encodeInt8(values: Float32Array, scale: number): string {
  const bytes = new Uint8Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const quantised = Math.max(-127, Math.min(127, Math.round(values[index] / scale)));
    bytes[index] = quantised < 0 ? quantised + 256 : quantised;
  }
  return toBase64(bytes);
}

function decodeInt8(encoded: string, scale: number, target: Float32Array) {
  const bytes = fromBase64(encoded);
  if (bytes.length !== target.length) throw new Error("weight length mismatch in cached model");
  for (let index = 0; index < bytes.length; index += 1) {
    const value = bytes[index] > 127 ? bytes[index] - 256 : bytes[index];
    target[index] = value * scale;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
}

function fromBase64(encoded: string): Uint8Array {
  const binary = typeof atob === "function" ? atob(encoded) : Buffer.from(encoded, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
