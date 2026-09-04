"""Feature extraction for a window of accelerometer samples.

Must stay in sync with backend/src/inference/features.js — both implement the
same formulas so the model trained here behaves identically when ported to
the Node backend for real-time inference.
"""

import numpy as np

FEATURE_NAMES = [
    "smvMax",
    "smvMin",
    "smvMean",
    "smvStd",
    "jerkPeak",
    "postPeakStillness",
]


def extract_features(samples):
    """samples: list of (x, y, z, t_ms) tuples, ordered by time."""
    xyz = np.array([(s[0], s[1], s[2]) for s in samples], dtype=float)
    t = np.array([s[3] for s in samples], dtype=float)

    smv = np.sqrt((xyz ** 2).sum(axis=1))

    smv_max = float(smv.max())
    smv_min = float(smv.min())
    smv_mean = float(smv.mean())
    smv_std = float(smv.std())

    dt = np.maximum(1.0, np.diff(t)) / 1000.0  # seconds
    jerk = np.abs(np.diff(smv)) / dt
    jerk_peak = float(jerk.max()) if len(jerk) else 0.0

    peak_idx = int(np.argmax(smv))
    post_peak = smv[peak_idx + 1 :]
    post_peak_stillness = float(post_peak.std()) if len(post_peak) else smv_std

    return [smv_max, smv_min, smv_mean, smv_std, jerk_peak, post_peak_stillness]
