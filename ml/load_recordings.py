"""Loads real accelerometer recordings captured via the frontend's Record
page, if an export has been saved locally.

Produces the exact (windows, labels) shape that generate_windows() returns,
so train_model.py can concatenate real recordings onto the synthetic dataset
with no other changes. No network access -- the export file is created by
visiting GET /api/recordings/export in a browser and saving the response to
ml/recordings_export.json.
"""

import json
import os

EXPORT_PATH = os.path.join(os.path.dirname(__file__), "recordings_export.json")


def load_recordings(path=EXPORT_PATH):
    if not os.path.exists(path):
        return [], []

    with open(path, "r", encoding="utf-8") as f:
        rows = json.load(f)

    windows = []
    labels = []
    for row in rows:
        samples = [(s["x"], s["y"], s["z"], s["t"]) for s in row["samples"]]
        windows.append(samples)
        labels.append(1 if row["label"] == "fall" else 0)

    return windows, labels
