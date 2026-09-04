import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFeatures } from "./features.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEIGHTS_PATH = path.join(__dirname, "..", "..", "model_weights.json");

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function loadTrainedModel() {
  if (!fs.existsSync(WEIGHTS_PATH)) return null;
  const raw = JSON.parse(fs.readFileSync(WEIGHTS_PATH, "utf-8"));
  if (raw.type !== "logistic_regression") {
    throw new Error(`Unsupported model type in model_weights.json: ${raw.type}`);
  }
  return raw;
}

// Reloaded lazily so training the model mid-hackathon and restarting the
// backend is enough to pick it up — no code change needed.
let cachedModel = undefined;
function getModel() {
  if (cachedModel === undefined) cachedModel = loadTrainedModel();
  return cachedModel;
}

export function reloadModel() {
  cachedModel = loadTrainedModel();
}

// Rule-based fallback used only until ml/train_model.py has produced
// backend/model_weights.json. Keeps the sensor -> classification -> alert
// pipeline demoable end-to-end before the real model exists.
function fallbackClassify(features) {
  const [smvMax, , , , jerkPeak, postPeakStillness] = features;
  const looksLikeImpact = smvMax > 25 && jerkPeak > 40;
  const looksLikeLyingStill = postPeakStillness < 1.5;
  const probability = looksLikeImpact && looksLikeLyingStill ? 0.9 : looksLikeImpact ? 0.55 : 0.05;
  return { probability, source: "fallback-rules" };
}

function trainedClassify(model, features) {
  const z = features.reduce((sum, f, i) => {
    const normalized = (f - model.featureMean[i]) / (model.featureStd[i] || 1);
    return sum + normalized * model.weights[i];
  }, model.bias);
  return { probability: sigmoid(z), source: "trained-model" };
}

// samples: array of { x, y, z, t } accelerometer readings for one window.
export function classifyWindow(samples) {
  const features = extractFeatures(samples);
  const model = getModel();
  const result = model ? trainedClassify(model, features) : fallbackClassify(features);
  return { ...result, features };
}
