from __future__ import annotations

import pandas as pd

from app.services.analytics import build_comparison_payload, prepare_history_frame


def test_prepare_history_frame_generates_core_metrics() -> None:
    frame = pd.DataFrame(
        {
            "date": pd.date_range("2025-01-01", periods=10, freq="D"),
            "open": [100, 101, 103, 104, 106, 108, 109, 112, 111, 113],
            "high": [101, 102, 104, 105, 107, 109, 110, 113, 113, 114],
            "low": [99, 100, 102, 103, 105, 107, 108, 110, 109, 112],
            "close": [101, 103, 104, 106, 108, 109, 112, 111, 113, 115],
            "volume": [1000, 1100, 1200, 1150, 1400, 1600, 1500, 1700, 1750, 1800],
        }
    )

    prepared = prepare_history_frame(frame)

    assert len(prepared.index) == 10
    assert prepared.iloc[0]["daily_return"] == 0.01
    assert prepared.iloc[-1]["moving_average_7"] == 110.57
    assert prepared.iloc[-1]["rolling_52w_high"] == 115
    assert prepared.iloc[-1]["rolling_52w_low"] == 101
    assert prepared.iloc[-1]["volatility_score"] > 0
    assert prepared.iloc[-1]["momentum_score"] > 0


def test_build_comparison_payload_tracks_outperformer() -> None:
    first = [
        {"date": "2025-01-01", "close": 100},
        {"date": "2025-01-02", "close": 104},
        {"date": "2025-01-03", "close": 107},
    ]
    second = [
        {"date": "2025-01-01", "close": 100},
        {"date": "2025-01-02", "close": 101},
        {"date": "2025-01-03", "close": 102},
    ]

    payload = build_comparison_payload("INFY", "TCS", first, second)

    assert payload["outperformer"] == "INFY"
    assert payload["series"]["INFY"][-1]["normalized_change_pct"] == 7.0
    assert payload["series"]["TCS"][-1]["normalized_change_pct"] == 2.0
    assert payload["correlation_close_price"] is not None

