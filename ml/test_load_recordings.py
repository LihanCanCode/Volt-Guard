import json

from load_recordings import load_recordings


def test_missing_export_file_returns_empty():
    windows, labels = load_recordings(path="does-not-exist.json")

    assert windows == []
    assert labels == []


def test_loads_and_maps_labels_correctly(tmp_path):
    export_path = tmp_path / "recordings_export.json"
    export_path.write_text(
        json.dumps(
            [
                {
                    "label": "fall",
                    "samples": [
                        {"x": 1.0, "y": 2.0, "z": 3.0, "t": 0},
                        {"x": 4.0, "y": 5.0, "z": 6.0, "t": 20},
                    ],
                },
                {
                    "label": "resting",
                    "samples": [
                        {"x": 0.1, "y": 0.2, "z": 9.8, "t": 0},
                        {"x": 0.0, "y": 0.1, "z": 9.7, "t": 20},
                    ],
                },
            ]
        )
    )

    windows, labels = load_recordings(path=str(export_path))

    assert labels == [1, 0]
    assert windows[0] == [(1.0, 2.0, 3.0, 0), (4.0, 5.0, 6.0, 20)]
    assert windows[1] == [(0.1, 0.2, 9.8, 0), (0.0, 0.1, 9.7, 20)]
