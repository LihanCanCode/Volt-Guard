import { test } from "node:test";
import assert from "node:assert/strict";
import { extractFeatures } from "./features.js";

function makeSamples(magnitudes, dtMs = 20) {
  return magnitudes.map((m, i) => ({ x: 0, y: 0, z: m, t: i * dtMs }));
}

test("computes correct SMV stats for a constant-magnitude resting-like window", () => {
  const samples = makeSamples(Array(20).fill(9.8));
  const [smvMax, smvMin, smvMean, smvStd, jerkPeak] = extractFeatures(samples);

  assert.ok(Math.abs(smvMax - 9.8) < 1e-9);
  assert.ok(Math.abs(smvMin - 9.8) < 1e-9);
  assert.ok(Math.abs(smvMean - 9.8) < 1e-9);
  assert.ok(Math.abs(smvStd) < 1e-9);
  assert.equal(jerkPeak, 0);
});

test("detects a jerk peak for a window with a single impact spike", () => {
  const magnitudes = [...Array(10).fill(9.8), 45, ...Array(10).fill(9.8)];
  const samples = makeSamples(magnitudes);
  const [, , , , jerkPeak] = extractFeatures(samples);

  assert.ok(jerkPeak > 1000, `expected a sharp jerk peak, got ${jerkPeak}`);
});

test("computes low postPeakStillness for a window that goes still after the peak (fall-like)", () => {
  const magnitudes = [...Array(10).fill(9.8), 45, ...Array(10).fill(9.8)];
  const samples = makeSamples(magnitudes);
  const [, , , , , postPeakStillness] = extractFeatures(samples);

  assert.ok(postPeakStillness < 0.5, `expected near-zero stillness, got ${postPeakStillness}`);
});

test("computes higher postPeakStillness for a window with continued motion after the peak (non-fall-like)", () => {
  const oscillating = [9.8, 14, 8, 16, 7, 15, 9, 13, 8.5, 14.5];
  const magnitudes = [...Array(10).fill(9.8), 45, ...oscillating];
  const samples = makeSamples(magnitudes);
  const [, , , , , postPeakStillness] = extractFeatures(samples);

  assert.ok(postPeakStillness > 2, `expected continued motion after peak, got ${postPeakStillness}`);
});
