import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyWindow } from "./model.js";

function makeSamples(magnitudes, dtMs = 20) {
  return magnitudes.map((m, i) => ({ x: 0, y: 0, z: m, t: i * dtMs }));
}

test("classifies a clearly fall-like window with probability > 0.5", () => {
  // Quiet, then a sharp impact spike, then stillness — the checked-in
  // model_weights.json was trained to score this pattern as a fall.
  const magnitudes = [...Array(10).fill(9.8), 45, ...Array(39).fill(9.8)];
  const samples = makeSamples(magnitudes);

  const { probability, source } = classifyWindow(samples);

  assert.equal(source, "trained-model");
  assert.ok(probability > 0.5, `expected fall-like probability > 0.5, got ${probability}`);
});

test("classifies a clearly resting-like window with probability < 0.5", () => {
  const samples = makeSamples(Array(50).fill(9.8));

  const { probability, source } = classifyWindow(samples);

  assert.equal(source, "trained-model");
  assert.ok(probability < 0.5, `expected resting-like probability < 0.5, got ${probability}`);
});
