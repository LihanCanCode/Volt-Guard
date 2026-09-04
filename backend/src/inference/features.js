// Feature extraction for a window of accelerometer samples.
// Must stay in sync with ml/features.py — both implement the same formulas
// so the model trained offline in Python behaves identically at inference time here.

function magnitude(sample) {
  return Math.sqrt(sample.x * sample.x + sample.y * sample.y + sample.z * sample.z);
}

function mean(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values) {
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) * (v - m)));
  return Math.sqrt(variance);
}

// samples: array of { x, y, z, t } accelerometer readings, ordered by time (t in ms).
// Returns the feature vector in the exact order the model expects.
export function extractFeatures(samples) {
  const smv = samples.map(magnitude);

  const smvMax = Math.max(...smv);
  const smvMin = Math.min(...smv);
  const smvMean = mean(smv);
  const smvStd = std(smv);

  // Jerk = rate of change of SMV between consecutive samples, normalized by dt.
  let jerkPeak = 0;
  for (let i = 1; i < smv.length; i++) {
    const dt = Math.max(1, samples[i].t - samples[i - 1].t) / 1000; // seconds
    const jerk = Math.abs(smv[i] - smv[i - 1]) / dt;
    if (jerk > jerkPeak) jerkPeak = jerk;
  }

  // Post-peak stillness: variance of SMV in the second half of the window,
  // following the largest spike. Real falls end in stillness; a phone drop bounces less predictably
  // but pocket jostling/walking keeps moving throughout, so this feature helps separate the two.
  const peakIdx = smv.indexOf(smvMax);
  const postPeak = smv.slice(peakIdx + 1);
  const postPeakStillness = postPeak.length > 0 ? std(postPeak) : smvStd;

  return [smvMax, smvMin, smvMean, smvStd, jerkPeak, postPeakStillness];
}

export const FEATURE_NAMES = [
  "smvMax",
  "smvMin",
  "smvMean",
  "smvStd",
  "jerkPeak",
  "postPeakStillness",
];
