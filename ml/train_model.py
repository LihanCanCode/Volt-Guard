"""Trains the fall-classification logistic regression model and exports its
weights to backend/model_weights.json, where backend/src/inference/model.js
loads them for real-time inference.

Run: python train_model.py
"""

import json
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from features import extract_features, FEATURE_NAMES
from generate_dataset import generate_windows
from load_recordings import load_recordings

OUTPUT_PATH = Path(__file__).parent.parent / "backend" / "model_weights.json"


def main():
    windows, labels = generate_windows(n_per_class=400, seed=42)

    real_windows, real_labels = load_recordings()
    print(f"Real recordings included: {len(real_windows)}")
    windows += real_windows
    labels += real_labels

    X = np.array([extract_features(w) for w in windows])
    y = np.array(labels)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    scaler = StandardScaler().fit(X_train)
    X_train_scaled = scaler.transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = LogisticRegression(max_iter=1000)
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred).tolist()

    print(f"Feature order: {FEATURE_NAMES}")
    print(f"Test accuracy: {accuracy:.3f}")
    print(f"Test F1:       {f1:.3f}")
    print(f"Confusion matrix [[TN, FP], [FN, TP]]: {cm}")

    weights = {
        "type": "logistic_regression",
        "featureNames": FEATURE_NAMES,
        "featureMean": scaler.mean_.tolist(),
        "featureStd": scaler.scale_.tolist(),
        "weights": model.coef_[0].tolist(),
        "bias": float(model.intercept_[0]),
        "threshold": 0.5,
        "metrics": {"accuracy": accuracy, "f1": f1, "confusionMatrix": cm},
    }

    OUTPUT_PATH.write_text(json.dumps(weights, indent=2))
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
