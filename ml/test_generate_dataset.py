from generate_dataset import generate_windows, N_SAMPLES


def test_windows_and_labels_shape():
    windows, labels = generate_windows(n_per_class=10, seed=1)

    assert len(windows) == len(labels)
    for window in windows:
        assert len(window) == N_SAMPLES
        for sample in window:
            assert len(sample) == 4


def test_labels_are_binary_with_expected_fall_count():
    n_per_class = 10
    windows, labels = generate_windows(n_per_class=n_per_class, seed=1)

    assert set(labels) <= {0, 1}
    assert labels.count(1) == n_per_class


def test_same_seed_is_reproducible():
    windows_a, labels_a = generate_windows(n_per_class=5, seed=7)
    windows_b, labels_b = generate_windows(n_per_class=5, seed=7)

    assert labels_a == labels_b
    assert windows_a == windows_b
