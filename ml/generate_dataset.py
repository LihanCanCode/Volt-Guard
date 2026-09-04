"""Generates labeled accelerometer windows: falls vs activities of daily
living (ADLs), following the same fall-vs-ADL evaluation convention used by
public fall-detection datasets (SisFall, MobiFall/MobiAct, UMAFall).

No internet/dataset download is required for this to run, which makes the
whole ml/ -> backend/model_weights.json pipeline reproducible offline during
the hackathon. If real hardware/phone recordings or a downloaded public
dataset become available, replace `generate_windows()` with a loader that
yields the same (samples, label) shape and everything downstream is unchanged.

Known limitation: a phone bouncing/settling after being dropped onto a hard
surface can look identical to a human fall on accelerometer data alone (both
end in a stillness period) -- this mirrors a real limitation of single-IMU
fall detection discussed in the literature, not something fixed here.
"""

import numpy as np

SAMPLE_RATE_HZ = 50
WINDOW_SECONDS = 2.5
N_SAMPLES = int(SAMPLE_RATE_HZ * WINDOW_SECONDS)


def _times_ms(rng):
    dt_ms = 1000.0 / SAMPLE_RATE_HZ
    jitter = rng.normal(0, 1.5, N_SAMPLES)
    return np.cumsum(np.full(N_SAMPLES, dt_ms) + jitter)


def _resting(rng, t, noise=0.25):
    x = rng.normal(0, noise, len(t))
    y = rng.normal(0, noise, len(t))
    z = 9.8 + rng.normal(0, noise, len(t))
    return x, y, z


def _oscillating(rng, t, freq_hz, amp, noise=0.4, sway=1.5):
    phase = rng.uniform(0, 2 * np.pi)
    bounce = amp * np.abs(np.sin(2 * np.pi * freq_hz * (t / 1000.0) + phase))
    x = sway * np.sin(2 * np.pi * freq_hz * 0.5 * (t / 1000.0) + phase) + rng.normal(0, noise, len(t))
    y = bounce * 0.6 + rng.normal(0, noise, len(t))
    z = 9.8 + bounce + rng.normal(0, noise, len(t))
    return x, y, z


def _single_bump(rng, t, bump_mag, settle_noise, bump_frac=0.4):
    n = len(t)
    bump_idx = int(n * bump_frac)
    width = max(3, n // 12)
    envelope = np.exp(-((np.arange(n) - bump_idx) ** 2) / (2 * width ** 2))
    x = rng.normal(0, 0.3, n) + envelope * bump_mag * rng.uniform(-0.5, 0.5)
    y = rng.normal(0, 0.3, n) + envelope * bump_mag * rng.uniform(0.3, 0.8)
    z = 9.8 + rng.normal(0, settle_noise, n) + envelope * bump_mag
    return x, y, z


def _fall(rng, t):
    n = len(t)
    impact_idx = int(n * rng.uniform(0.35, 0.55))
    pre_x, pre_y, pre_z = _resting(rng, t, noise=rng.uniform(0.3, 0.8))

    impact_mag = rng.uniform(25, 45)
    width = max(2, n // 30)
    envelope = np.exp(-((np.arange(n) - impact_idx) ** 2) / (2 * width ** 2))

    x = pre_x + envelope * impact_mag * rng.uniform(-0.6, 0.6)
    y = pre_y + envelope * impact_mag * rng.uniform(-0.6, 0.6)
    z = pre_z + envelope * impact_mag

    # after impact: lying still, very low residual noise
    still_noise = rng.uniform(0.05, 0.25)
    post_mask = np.arange(n) > impact_idx + width
    x[post_mask] = rng.normal(0, still_noise, post_mask.sum())
    y[post_mask] = rng.normal(0, still_noise, post_mask.sum())
    z[post_mask] = 9.8 * rng.choice([0.3, 1.0]) + rng.normal(0, still_noise, post_mask.sum())

    return x, y, z


def generate_windows(n_per_class=100, seed=42):
    rng = np.random.default_rng(seed)
    windows = []
    labels = []

    def add(x, y, z, t, label):
        samples = list(zip(x.tolist(), y.tolist(), z.tolist(), t.tolist()))
        windows.append(samples)
        labels.append(label)

    for _ in range(n_per_class):
        t = _times_ms(rng)
        x, y, z = _fall(rng, t)
        add(x, y, z, t, 1)

    adl_generators = {
        "resting": lambda rng, t: _resting(rng, t, noise=rng.uniform(0.1, 0.4)),
        "walking": lambda rng, t: _oscillating(rng, t, freq_hz=rng.uniform(1.6, 2.2), amp=rng.uniform(2, 4)),
        "jogging": lambda rng, t: _oscillating(rng, t, freq_hz=rng.uniform(2.4, 3.2), amp=rng.uniform(4, 9)),
        "sitting_down": lambda rng, t: _single_bump(rng, t, bump_mag=rng.uniform(10, 16), settle_noise=rng.uniform(0.3, 0.8)),
        "standing_up": lambda rng, t: _single_bump(rng, t, bump_mag=rng.uniform(10, 15), settle_noise=rng.uniform(0.5, 1.2)),
    }

    per_adl = max(1, n_per_class // len(adl_generators))
    for _name, gen in adl_generators.items():
        for _ in range(per_adl):
            t = _times_ms(rng)
            x, y, z = gen(rng, t)
            add(x, y, z, t, 0)

    return windows, labels
