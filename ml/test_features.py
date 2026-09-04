import pytest

from features import extract_features, FEATURE_NAMES


def _window(z_values, t_values, x=None, y=None):
    n = len(z_values)
    x = x if x is not None else [0.0] * n
    y = y if y is not None else [0.0] * n
    return list(zip(x, y, z_values, t_values))


def test_constant_window_has_zero_variation():
    t = [i * 20 for i in range(10)]
    samples = _window([9.8] * 10, t)

    smv_max, smv_min, smv_mean, smv_std, jerk_peak, post_peak_stillness = extract_features(samples)

    assert smv_max == pytest.approx(9.8)
    assert smv_min == pytest.approx(9.8)
    assert smv_mean == pytest.approx(9.8)
    assert smv_std == pytest.approx(0.0)
    assert jerk_peak == pytest.approx(0.0)
    assert post_peak_stillness == pytest.approx(0.0)


def test_jerk_peak_matches_hand_computed_spike():
    t = [0, 100, 200, 300, 400]
    samples = _window([9.8, 9.8, 50.0, 9.8, 9.8], t)

    _, _, _, _, jerk_peak, _ = extract_features(samples)

    # diff(smv) = [0, 40.2, -40.2, 0], dt = 0.1s each -> peak jerk = 40.2 / 0.1
    assert jerk_peak == pytest.approx(402.0, rel=1e-3)


def test_post_peak_stillness_lower_when_window_settles_after_peak():
    t = [0, 100, 200, 300, 400, 500]
    settled = _window([9.8, 9.8, 50.0, 9.8, 9.8, 9.8], t)
    still_moving = _window([9.8, 9.8, 50.0, 20.0, 35.0, 15.0], t)

    _, _, _, _, _, settled_stillness = extract_features(settled)
    _, _, _, _, _, moving_stillness = extract_features(still_moving)

    assert settled_stillness < moving_stillness


def test_feature_names_match_extracted_feature_count():
    t = [0, 100, 200]
    samples = _window([9.8, 9.8, 9.8], t)

    result = extract_features(samples)

    assert len(result) == len(FEATURE_NAMES)
