from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd


def prepare_history_frame(raw_frame: pd.DataFrame) -> pd.DataFrame:
    if raw_frame.empty:
        raise ValueError("No rows returned from the upstream data source.")

    frame = raw_frame.copy()
    frame.columns = [str(column).strip().lower().replace(" ", "_") for column in frame.columns]

    required_columns = {"date", "open", "high", "low", "close", "volume"}
    missing_columns = required_columns.difference(frame.columns)
    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {sorted(missing_columns)}")

    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    numeric_columns = ["open", "high", "low", "close", "volume"]
    frame[numeric_columns] = frame[numeric_columns].apply(pd.to_numeric, errors="coerce")

    frame = frame.dropna(subset=["date", "open", "high", "low", "close"])
    frame = frame.sort_values("date").drop_duplicates(subset=["date"], keep="last")
    frame[numeric_columns] = frame[numeric_columns].ffill().bfill()
    frame["volume"] = frame["volume"].fillna(0)

    frame["daily_return"] = np.where(
        frame["open"].eq(0),
        0.0,
        (frame["close"] - frame["open"]) / frame["open"],
    )
    frame["moving_average_7"] = frame["close"].rolling(window=7, min_periods=1).mean()
    frame["rolling_52w_high"] = frame["close"].rolling(window=252, min_periods=1).max()
    frame["rolling_52w_low"] = frame["close"].rolling(window=252, min_periods=1).min()

    rolling_volatility = frame["daily_return"].rolling(window=14, min_periods=2).std().fillna(0.0)
    frame["volatility_score"] = rolling_volatility * math.sqrt(252) * 100
    frame["momentum_score"] = frame["close"].pct_change(periods=7).fillna(0.0) * 100
    frame["symbol"] = ""

    frame["date"] = frame["date"].dt.date.astype(str)
    frame = frame.fillna(0.0)

    return frame[
        [
            "symbol",
            "date",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "daily_return",
            "moving_average_7",
            "rolling_52w_high",
            "rolling_52w_low",
            "volatility_score",
            "momentum_score",
        ]
    ].round(
        {
            "open": 2,
            "high": 2,
            "low": 2,
            "close": 2,
            "daily_return": 6,
            "moving_average_7": 2,
            "rolling_52w_high": 2,
            "rolling_52w_low": 2,
            "volatility_score": 2,
            "momentum_score": 2,
        }
    )


def build_comparison_payload(
    symbol_one: str,
    symbol_two: str,
    history_one: list[dict[str, Any]],
    history_two: list[dict[str, Any]],
) -> dict[str, Any]:
    normalized_one = normalize_history(history_one)
    normalized_two = normalize_history(history_two)
    correlation = calculate_close_correlation(history_one, history_two)

    final_one = normalized_one[-1]["normalized_change_pct"] if normalized_one else 0.0
    final_two = normalized_two[-1]["normalized_change_pct"] if normalized_two else 0.0

    if final_one > final_two:
        outperformer = symbol_one
    elif final_two > final_one:
        outperformer = symbol_two
    else:
        outperformer = "TIE"

    return {
        "symbols": [symbol_one, symbol_two],
        "comparison_window_days": max(len(history_one), len(history_two)),
        "correlation_close_price": correlation,
        "outperformer": outperformer,
        "performance_gap_pct": round(final_one - final_two, 2),
        "series": {
            symbol_one: normalized_one,
            symbol_two: normalized_two,
        },
    }


def normalize_history(history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not history:
        return []

    baseline = history[0]["close"] or 1
    normalized = []
    for row in history:
        normalized.append(
            {
                "date": row["date"],
                "close": row["close"],
                "normalized_change_pct": round(((row["close"] / baseline) - 1) * 100, 2),
            }
        )
    return normalized


def calculate_close_correlation(
    history_one: list[dict[str, Any]],
    history_two: list[dict[str, Any]],
) -> float | None:
    first = {item["date"]: item["close"] for item in history_one}
    second = {item["date"]: item["close"] for item in history_two}
    common_dates = sorted(set(first).intersection(second))

    if len(common_dates) < 3:
        return None

    first_series = pd.Series([first[date] for date in common_dates], dtype=float)
    second_series = pd.Series([second[date] for date in common_dates], dtype=float)

    return round(float(first_series.corr(second_series)), 4)

